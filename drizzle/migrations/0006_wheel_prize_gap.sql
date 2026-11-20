-- Minimum minutes between two real prizes: one hour, shortened only when the prizes still to give
-- would not otherwise fit into the open minutes left today.
CREATE OR REPLACE FUNCTION public.wheel_prize_gap(p_minutes_left numeric, p_remaining integer)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_remaining <= 0 THEN 60 ELSE LEAST(60, GREATEST(p_minutes_left, 0) / p_remaining) END::numeric;
$$;

CREATE INDEX IF NOT EXISTS wheel_claims_created_at_idx ON public.wheel_claims (created_at);

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
  v_last timestamptz;
  v_remaining integer := 0;
  v_gap numeric;
  v_gap_open boolean;
  v_lucky integer[] := '{}';
  v_pool integer[] := '{}';
  v_miss integer[] := '{}';
  v_idx integer;
  v_prize jsonb;
  v_limit integer;
  v_won integer;
  v_wins jsonb := '{}'::jsonb;
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
  SELECT COALESCE(jsonb_object_agg(prize, count), '{}'::jsonb) INTO v_wins FROM public.wheel_wins WHERE day = v_today;
  -- Every issued prize code counts, verified or not.
  SELECT max(created_at) INTO v_last FROM public.wheel_claims
    WHERE created_at >= (v_today::timestamp AT TIME ZONE 'Europe/Istanbul');

  FOR i IN 0 .. jsonb_array_length(v_prizes) - 1 LOOP
    v_prize := v_prizes -> i;
    IF v_prize ->> 'limit' IS NOT NULL AND (v_prize ->> 'limit')::integer > 0 THEN
      v_remaining := v_remaining + GREATEST(0, (v_prize ->> 'limit')::integer - COALESCE((v_wins ->> (v_prize ->> 't'))::integer, 0));
    END IF;
  END LOOP;
  v_gap := public.wheel_prize_gap(v_close - extract(epoch FROM v_local::time) / 60.0, v_remaining);
  v_gap_open := v_last IS NULL OR now() - v_last >= v_gap * interval '1 minute';

  FOR i IN 0 .. jsonb_array_length(v_prizes) - 1 LOOP
    v_prize := v_prizes -> i;
    IF COALESCE((v_prize ->> 'x')::boolean, false) THEN
      v_miss := v_miss || i;
    ELSIF v_prize ->> 'limit' IS NULL THEN
      v_pool := v_pool || i;
    ELSIF v_gap_open THEN
      v_limit := (v_prize ->> 'limit')::integer;
      IF v_limit > 0 THEN
        v_won := COALESCE((v_wins ->> (v_prize ->> 't'))::integer, 0);
        IF v_won < public.wheel_prize_ceiling(v_limit, v_frac)
           AND random() < public.wheel_prize_chance(v_limit - v_won, v_frac, v_spins, v_hist) THEN
          v_lucky := v_lucky || i;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_lucky, 1) IS NOT NULL THEN
    v_idx := v_lucky[1 + floor(random() * array_length(v_lucky, 1))::integer];
  ELSIF array_length(v_miss, 1) IS NOT NULL THEN
    -- Unlimited real prizes win only rarely and still respect the gap; otherwise "Maybe Next Time".
    IF v_gap_open AND array_length(v_pool, 1) IS NOT NULL AND random() < 0.1 THEN
      v_idx := v_pool[1 + floor(random() * array_length(v_pool, 1))::integer];
    ELSE
      v_idx := v_miss[1 + floor(random() * array_length(v_miss, 1))::integer];
    END IF;
  ELSIF array_length(v_pool, 1) IS NOT NULL THEN
    v_idx := v_pool[1 + floor(random() * array_length(v_pool, 1))::integer];
  ELSE
    v_idx := 0;
  END IF;
  INSERT INTO public.wheel_wins (day, prize, count) VALUES (v_today, v_prizes -> v_idx ->> 't', 1)
    ON CONFLICT (day, prize) DO UPDATE SET count = public.wheel_wins.count + 1;
  RETURN v_idx;
END;
$$;
REVOKE ALL ON FUNCTION public.spin_wheel() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spin_wheel() TO service_role;
REVOKE ALL ON FUNCTION public.wheel_prize_gap(numeric, integer) FROM PUBLIC, anon, authenticated;