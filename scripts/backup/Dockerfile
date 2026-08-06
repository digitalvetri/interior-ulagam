# Postgres client for pg_dump, plus the MinIO client for object storage.
FROM postgres:16-alpine
RUN apk add --no-cache curl \
 && curl -fsSL https://dl.min.io/client/mc/release/linux-$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')/mc \
      -o /usr/local/bin/mc \
 && chmod +x /usr/local/bin/mc \
 && apk del curl
COPY run-backup.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/run-backup.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
