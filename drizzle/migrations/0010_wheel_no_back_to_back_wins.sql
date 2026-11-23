ALTER TABLE public.wheel_spins ADD COLUMN IF NOT EXISTS last_won boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.spin_wheel_guest(p_device text, p_ip text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_hour timestamptz := date_trunc('hour', now());
  v_max integer;
  v_used integer;
  v_last_won boolean;
  v_ip integer;
  v_idx integer := NULL;
  v_prizes jsonb;
  v_prize jsonb;
  v_won boolean;
  v_code text := NULL;
  i integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('wheel_device:' || p_device));
  SELECT max_spins, prizes INTO v_max, v_prizes FROM public.wheel_settings WHERE id = 1;
  SELECT count, last_won INTO v_used, v_last_won FROM public.wheel_spins WHERE device_id = p_device AND day = v_today;
  v_used := COALESCE(v_used, 0);
  v_last_won := COALESCE(v_last_won, false);
  IF COALESCE(v_max, 0) > 0 AND v_used >= v_max THEN
    RETURN jsonb_build_object('status', 'device_limit', 'used', v_used);
  END IF;
  SELECT count INTO v_ip FROM public.wheel_ip_spins WHERE ip_hash = p_ip AND hour = v_hour;
  IF COALESCE(v_ip, 0) >= 60 THEN
    RETURN jsonb_build_object('status', 'ip_limit', 'used', v_used);
  END IF;

  -- The same device never wins twice in a row: after any prize, its next spin today is a miss.
  IF v_last_won AND v_prizes IS NOT NULL THEN
    FOR i IN 0 .. jsonb_array_length(v_prizes) - 1 LOOP
      IF COALESCE((v_prizes -> i ->> 'x')::boolean, false) THEN
        v_idx := i;
        EXIT;
      END IF;
    END LOOP;
    IF v_idx IS NOT NULL THEN
      INSERT INTO public.wheel_wins (day, prize, count) VALUES (v_today, v_prizes -> v_idx ->> 't', 1)
        ON CONFLICT (day, prize) DO UPDATE SET count = public.wheel_wins.count + 1;
    END IF;
  END IF;

  IF v_idx IS NULL THEN
    v_idx := public.spin_wheel();
  END IF;
  IF v_idx IS NULL THEN
    RETURN jsonb_build_object('status', 'unavailable');
  END IF;
  SELECT prizes -> v_idx INTO v_prize FROM public.wheel_settings WHERE id = 1;
  v_won := NOT COALESCE((v_prize ->> 'x')::boolean, false);
  INSERT INTO public.wheel_ip_spins (ip_hash, hour, count) VALUES (p_ip, v_hour, 1)
    ON CONFLICT (ip_hash, hour) DO UPDATE SET count = public.wheel_ip_spins.count + 1;
  INSERT INTO public.wheel_spins (device_id, day, count, last_won) VALUES (p_device, v_today, 1, v_won)
    ON CONFLICT (device_id, day) DO UPDATE SET count = public.wheel_spins.count + 1, last_won = v_won;
  DELETE FROM public.wheel_ip_spins WHERE hour < now() - interval '2 days';
  IF v_won THEN
    INSERT INTO public.wheel_claims (code, prize, expires_at)
      VALUES (p_code, v_prize ->> 't', ((v_today + 1)::timestamp AT TIME ZONE 'Europe/Istanbul'));
    v_code := p_code;
  END IF;
  RETURN jsonb_build_object('status', 'ok', 'index', v_idx, 'code', v_code, 'used', v_used + 1);
END;
$$;
REVOKE ALL ON FUNCTION public.spin_wheel_guest(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spin_wheel_guest(text, text, text) TO service_role;