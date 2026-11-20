ALTER TABLE public.wheel_settings
  ADD COLUMN open_hour integer NOT NULL DEFAULT 8 CHECK (open_hour BETWEEN 0 AND 23),
  ADD COLUMN close_hour integer NOT NULL DEFAULT 22 CHECK (close_hour BETWEEN 1 AND 24);
ALTER TABLE public.wheel_settings ADD CONSTRAINT wheel_settings_hours_order CHECK (close_hour > open_hour);

-- How many winners of a limited prize may exist so far today: the day's open hours are split
-- into p_limit equal parts and each prize unlocks in the middle of its part.
CREATE OR REPLACE FUNCTION public.wheel_prize_allowance(p_limit integer, p_local time, p_open integer, p_close integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT LEAST(p_limit, floor(p_limit * GREATEST(0, LEAST(1,
    (extract(epoch FROM p_local) / 3600.0 - p_open) / (p_close - p_open))) + 0.5)::integer);
$$;
REVOKE ALL ON FUNCTION public.wheel_prize_allowance(integer, time, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wheel_prize_allowance(integer, time, integer, integer) TO service_role;

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
  v_ok integer[] := '{}';
  v_idx integer;
  v_prize jsonb;
  v_limit integer;
  v_won integer;
  i integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('spin_wheel'));
  SELECT prizes, open_hour, close_hour INTO v_prizes, v_open, v_close FROM public.wheel_settings WHERE id = 1;
  IF v_prizes IS NULL OR jsonb_array_length(v_prizes) = 0 THEN
    RETURN NULL;
  END IF;
  FOR i IN 0 .. jsonb_array_length(v_prizes) - 1 LOOP
    v_prize := v_prizes -> i;
    IF v_prize ->> 'limit' IS NULL THEN
      v_ok := v_ok || i;
    ELSE
      v_limit := (v_prize ->> 'limit')::integer;
      SELECT count INTO v_won FROM public.wheel_wins WHERE day = v_today AND prize = v_prize ->> 't';
      IF public.wheel_prize_allowance(v_limit, v_local::time, v_open, v_close) - COALESCE(v_won, 0) > 0 THEN
        v_ok := v_ok || i;
      END IF;
    END IF;
  END LOOP;
  IF array_length(v_ok, 1) IS NULL THEN
    FOR i IN 0 .. jsonb_array_length(v_prizes) - 1 LOOP
      IF COALESCE((v_prizes -> i ->> 'x')::boolean, false) THEN v_ok := ARRAY[i]; END IF;
    END LOOP;
    IF array_length(v_ok, 1) IS NULL THEN v_ok := ARRAY[0]; END IF;
  END IF;
  v_idx := v_ok[1 + floor(random() * array_length(v_ok, 1))::integer];
  INSERT INTO public.wheel_wins (day, prize, count) VALUES (v_today, v_prizes -> v_idx ->> 't', 1)
    ON CONFLICT (day, prize) DO UPDATE SET count = public.wheel_wins.count + 1;
  RETURN v_idx;
END;
$$;
REVOKE ALL ON FUNCTION public.spin_wheel() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spin_wheel() TO service_role;