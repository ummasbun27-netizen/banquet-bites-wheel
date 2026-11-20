ALTER TABLE public.wheel_settings
  ADD COLUMN IF NOT EXISTS last_spin_miss boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS miss_pair_day date,
  ADD COLUMN IF NOT EXISTS miss_pairs integer NOT NULL DEFAULT 0;

-- Chance that a "Maybe Next Time" right after another one is allowed: pairs still allowed today
-- divided by the misses still expected today (1 in 5 of the spins still expected).
CREATE OR REPLACE FUNCTION public.wheel_miss_repeat_chance(p_pairs_left integer, p_frac numeric, p_spins integer, p_hist numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_pairs_left <= 0 THEN 0
    ELSE LEAST(1, p_pairs_left / GREATEST(GREATEST(GREATEST(p_spins / GREATEST(p_frac, 0.1), COALESCE(p_hist, 30)) * (1 - p_frac), 1) * 0.2, 1)) END::numeric;
$$;
REVOKE ALL ON FUNCTION public.wheel_miss_repeat_chance(integer, numeric, integer, numeric) FROM PUBLIC, anon, authenticated;

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
  v_last_miss boolean;
  v_pair_day date;
  v_pairs integer;
  v_is_miss boolean;
  v_pmiss numeric;
  v_local timestamp := now() AT TIME ZONE 'Europe/Istanbul';
  v_today date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_frac numeric;
  v_spins integer;
  v_hist numeric;
  v_last timestamptz;
  v_remaining integer := 0;
  v_left numeric;
  v_gap numeric;
  v_boost numeric;
  v_gap_open boolean;
  v_lucky integer[] := '{}';
  v_pool integer[] := '{}';
  v_cons integer[] := '{}';
  v_miss integer[] := '{}';
  v_cons_names text[] := '{}';
  v_idx integer;
  v_prize jsonb;
  v_limit integer;
  v_won integer;
  v_wins jsonb := '{}'::jsonb;
  i integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('spin_wheel'));
  SELECT prizes, open_minute, close_minute, last_spin_miss, miss_pair_day, miss_pairs
    INTO v_prizes, v_open, v_close, v_last_miss, v_pair_day, v_pairs FROM public.wheel_settings WHERE id = 1;
  IF v_prizes IS NULL OR jsonb_array_length(v_prizes) = 0 THEN
    RETURN NULL;
  END IF;
  IF v_pair_day IS DISTINCT FROM v_today THEN v_pairs := 0; END IF;
  SELECT COALESCE(array_agg(p ->> 't'), '{}') INTO v_cons_names FROM jsonb_array_elements(v_prizes) p
    WHERE COALESCE((p ->> 'f')::boolean, false) AND p ->> 'limit' IS NULL AND NOT COALESCE((p ->> 'x')::boolean, false);
  v_frac := public.wheel_day_fraction(v_local::time, v_open, v_close);
  SELECT COALESCE(sum(count), 0) INTO v_spins FROM public.wheel_spins WHERE day = v_today;
  SELECT avg(total) INTO v_hist FROM (
    SELECT sum(count) AS total FROM public.wheel_spins WHERE day >= v_today - 7 AND day < v_today GROUP BY day
  ) h;
  SELECT COALESCE(jsonb_object_agg(prize, count), '{}'::jsonb) INTO v_wins FROM public.wheel_wins WHERE day = v_today;
  -- Every issued prize code counts, verified or not; the common consolation prize does not reset the gap.
  SELECT max(created_at) INTO v_last FROM public.wheel_claims
    WHERE created_at >= (v_today::timestamp AT TIME ZONE 'Europe/Istanbul') AND NOT (prize = ANY (v_cons_names));

  FOR i IN 0 .. jsonb_array_length(v_prizes) - 1 LOOP
    v_prize := v_prizes -> i;
    IF v_prize ->> 'limit' IS NOT NULL AND (v_prize ->> 'limit')::integer > 0 THEN
      v_remaining := v_remaining + GREATEST(0, (v_prize ->> 'limit')::integer - COALESCE((v_wins ->> (v_prize ->> 't'))::integer, 0));
    END IF;
  END LOOP;
  v_left := v_close - extract(epoch FROM v_local::time) / 60.0;
  v_gap := public.wheel_prize_gap(v_left, v_remaining);
  v_boost := public.wheel_prize_gap_boost(v_left, v_remaining, v_gap);
  v_gap_open := v_last IS NULL OR now() - v_last >= v_gap * interval '1 minute';

  FOR i IN 0 .. jsonb_array_length(v_prizes) - 1 LOOP
    v_prize := v_prizes -> i;
    IF COALESCE((v_prize ->> 'x')::boolean, false) THEN
      v_miss := v_miss || i;
    ELSIF v_prize ->> 'limit' IS NULL AND COALESCE((v_prize ->> 'f')::boolean, false) THEN
      v_cons := v_cons || i;
    ELSIF v_prize ->> 'limit' IS NULL THEN
      v_pool := v_pool || i;
    ELSIF v_gap_open THEN
      v_limit := (v_prize ->> 'limit')::integer;
      IF v_limit > 0 THEN
        v_won := COALESCE((v_wins ->> (v_prize ->> 't'))::integer, 0);
        IF v_won < public.wheel_prize_ceiling(v_limit, v_frac)
           AND random() < LEAST(1, public.wheel_prize_chance(v_limit - v_won, v_frac, v_spins, v_hist) * v_boost) THEN
          v_lucky := v_lucky || i;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_lucky, 1) IS NOT NULL THEN
    v_idx := v_lucky[1 + floor(random() * array_length(v_lucky, 1))::integer];
  ELSIF v_gap_open AND array_length(v_pool, 1) IS NOT NULL AND (array_length(v_miss, 1) IS NOT NULL OR array_length(v_cons, 1) IS NOT NULL) AND random() < 0.1 THEN
    -- Other unlimited real prizes win only rarely and still respect the gap.
    v_idx := v_pool[1 + floor(random() * array_length(v_pool, 1))::integer];
  ELSIF array_length(v_cons, 1) IS NOT NULL AND array_length(v_miss, 1) IS NOT NULL THEN
    -- No big prize: "Maybe Next Time" about 1 in 5, twice in a row only about 3 times a day.
    v_pmiss := CASE WHEN v_last_miss THEN public.wheel_miss_repeat_chance(GREATEST(0, 3 - v_pairs), v_frac, v_spins, v_hist) ELSE 0.2 END;
    IF random() < v_pmiss THEN
      v_idx := v_miss[1 + floor(random() * array_length(v_miss, 1))::integer];
    ELSE
      v_idx := v_cons[1 + floor(random() * array_length(v_cons, 1))::integer];
    END IF;
  ELSIF array_length(v_cons, 1) IS NOT NULL THEN
    v_idx := v_cons[1 + floor(random() * array_length(v_cons, 1))::integer];
  ELSIF array_length(v_miss, 1) IS NOT NULL THEN
    v_idx := v_miss[1 + floor(random() * array_length(v_miss, 1))::integer];
  ELSIF array_length(v_pool, 1) IS NOT NULL THEN
    v_idx := v_pool[1 + floor(random() * array_length(v_pool, 1))::integer];
  ELSE
    v_idx := 0;
  END IF;
  v_is_miss := COALESCE((v_prizes -> v_idx ->> 'x')::boolean, false);
  UPDATE public.wheel_settings SET last_spin_miss = v_is_miss, miss_pair_day = v_today,
    miss_pairs = v_pairs + CASE WHEN v_is_miss AND v_last_miss THEN 1 ELSE 0 END
    WHERE id = 1;
  INSERT INTO public.wheel_wins (day, prize, count) VALUES (v_today, v_prizes -> v_idx ->> 't', 1)
    ON CONFLICT (day, prize) DO UPDATE SET count = public.wheel_wins.count + 1;
  RETURN v_idx;
END;
$$;
REVOKE ALL ON FUNCTION public.spin_wheel() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spin_wheel() TO service_role;