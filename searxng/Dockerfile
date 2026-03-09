# SearXNG custom image for KYNS — bakes our settings.yml with JSON format enabled.
FROM searxng/searxng:latest

# Switch to root to copy config files
USER root

# Pre-create /etc/searxng and copy our custom config
# The entrypoint will detect settings.yml already exists and skip template copy
RUN mkdir -p /etc/searxng
COPY settings.yml /etc/searxng/settings.yml
COPY limiter.toml /etc/searxng/limiter.toml
RUN chown -R 977:977 /etc/searxng && chmod 644 /etc/searxng/settings.yml /etc/searxng/limiter.toml

# Run as the searxng user (as the official image expects)
USER searxng

EXPOSE 8080
