-- Site-log photos were saved as 7-day presigned links and stopped loading.
-- Rewrite them to the stable /api/v1/projects/<id>/photos?key=… URL, which
-- re-signs on every view. Other values (already stable, or external) are kept.
UPDATE "site_logs" sl
SET "photos" = ARRAY(
  SELECT CASE
    WHEN p ~ '^https?://.*/projects/[0-9a-f-]{36}/photos/[A-Za-z0-9._-]+\?.*X-Amz-'
      THEN '/api/v1/projects/' || substring(p from 'projects/([0-9a-f-]{36})/photos/')
           || '/photos?key=' || substring(p from '(projects/[0-9a-f-]{36}/photos/[A-Za-z0-9._-]+)\?')
    ELSE p
  END
  FROM unnest(sl."photos") WITH ORDINALITY AS t(p, ord)
  ORDER BY ord
)
WHERE EXISTS (SELECT 1 FROM unnest(sl."photos") AS u(p) WHERE p ~ 'X-Amz-');
