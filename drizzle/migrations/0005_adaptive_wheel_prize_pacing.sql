ALTER TABLE public.wheel_settings
  ADD COLUMN open_minute integer NOT NULL DEFAULT 450 CHECK (open_minute BETWEEN 0 AND 1410),
  ADD COLUMN close_minute integer NOT NULL DEFAULT 1260 CHECK (close_minute BETWEEN 30 AND 1440);
ALTER TABLE public.wheel_settings ADD CONSTRAINT wheel_settings_minutes_order CHECK (close_minute > open_minute);
COMMENT ON COLUMN public.wheel_settings.open_hour IS 'DEPRECATED: replaced by open_minute';
COMMENT ON COLUMN public.wheel_settings.close_hour IS 'DEPRECATED: replaced by close_minute';
COMMENT ON FUNCTION public.wheel_prize_allowance(integer, time, integer, integer) IS 'DEPRECATED: replaced by wheel_prize_ceiling and wheel_prize_chance';

-- Share of today's open hours that has passed: 0 before opening, 1 after closing.
CREATE OR REPLACE FUNCTION public.wheel_day_fraction(p_local time, p_open integer, p_close integer)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT GREATEST(0, LEAST(1, (extract(epoch FROM p_local) / 60.0 - p_open) / (p_close - p_open)))::numeric;
$$;

-- Hard ceiling: open hours split into p_limit parts, each part releases one more winner; unwon prizes roll over.
CREATE OR REPLACE FUNCTION public.wheel_prize_ceiling(p_limit integer, p_frac numeric)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_frac <= 0 THEN 0 WHEN p_frac >= 1 THEN p_limit
    ELSE LEAST(p_limit, floor(p_limit * p_frac)::integer + 1) END;
$$;

-- Chance this spin wins one remaining copy: remaining copies / spins still expected today.
-- Expected daily spins = larger of today's pace and the last-7-day average (30 without history).
CREATE OR REPLACE FUNCTION public.wheel_prize_chance(p_remaining integer, p_frac numeric, p_today_spins integer, p_history numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT LEAST(1, p_remaining / GREATEST(
    GREATEST(p_today_spins / GREATEST(p_frac, 0.1), COALESCE(p_history, 30)) * (1 - p_frac), 1));
$$;

CREATE OR REPLACE FUNCTION public.spin_wheel()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prizes jsonb;
  v_open integer;
  v_close integer;
  v_local timestamp := now() AT TIME ZONE 'Europe/Istanbul';
  v_today date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_frac numeric;
  v_spins integer;
  v_hist numeric;
  v_lucky integer[] := '{}';
  v_pool integer[] := '{}';
  v_idx integer;
  v_prize jsonb;
  v_limit integer;
  v_won integer;
  i integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('spin_wheel'));
  SELECT prizes, open_minute, close_minute INTO v_prizes, v_open, v_close FROM public.wheel_settings WHERE id = 1;
  IF v_prizes IS NULL OR jsonb_array_length(v_prizes) = 0 THEN
    RETURN NULL;
  END IF;
  v_frac := public.wheel_day_fraction(v_local::time, v_open, v_close);
  SELECT COALESCE(sum(count), 0) INTO v_spins FROM public.wheel_spins WHERE day = v_today;
  SELECT avg(total) INTO v_hist FROM (
    SELECT sum(count) AS total FROM public.wheel_spins WHERE day >= v_today - 7 AND day < v_today GROUP BY day
  ) h;
  FOR i IN 0 .. jsonb_array_length(v_prizes) - 1 LOOP
    v_prize := v_prizes -> i;
    IF v_prize ->> 'limit' IS NULL THEN
      v_pool := v_pool || i;
    ELSE
      v_limit := (v_prize ->> 'limit')::integer;
      IF v_limit > 0 THEN
        SELECT count INTO v_won FROM public.wheel_wins WHERE day = v_today AND prize = v_prize ->> 't';
        v_won := COALESCE(v_won, 0);
        IF v_won < public.wheel_prize_ceiling(v_limit, v_frac)
           AND random() < public.wheel_prize_chance(v_limit - v_won, v_frac, v_spins, v_hist) THEN
          v_lucky := v_lucky || i;
        END IF;
      END IF;
    END IF;
  END LOOP;
  IF array_length(v_lucky, 1) IS NOT NULL THEN
    v_idx := v_lucky[1 + floor(random() * array_length(v_lucky, 1))::integer];
  ELSIF array_length(v_pool, 1) IS NOT NULL THEN
    v_idx := v_pool[1 + floor(random() * array_length(v_pool, 1))::integer];
  ELSE
    v_idx := NULL;
    FOR i IN 0 .. jsonb_array_length(v_prizes) - 1 LOOP
      IF COALESCE((v_prizes -> i ->> 'x')::boolean, false) THEN v_idx := i; END IF;
    END LOOP;
    IF v_idx IS NULL THEN v_idx := 0; END IF;
  END IF;
  INSERT INTO public.wheel_wins (day, prize, count) VALUES (v_today, v_prizes -> v_idx ->> 't', 1)
    ON CONFLICT (day, prize) DO UPDATE SET count = public.wheel_wins.count + 1;
  RETURN v_idx;
END;
$$;
REVOKE ALL ON FUNCTION public.spin_wheel() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spin_wheel() TO service_role;