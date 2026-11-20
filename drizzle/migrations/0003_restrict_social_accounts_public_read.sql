DROP POLICY IF EXISTS "Public can view social accounts" ON public.social_accounts;
REVOKE SELECT ON public.social_accounts FROM anon, authenticated;
GRANT SELECT (id, url, position) ON public.social_accounts TO anon, authenticated;
CREATE POLICY "Public can view linked social accounts" ON public.social_accounts
  FOR SELECT TO anon, authenticated
  USING (url <> '');