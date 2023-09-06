#########################################################################################
FROM node:20-alpine3.18 AS builder

ARG BUILD_VERSION=0.1

WORKDIR /src

COPY package.json package-lock.json webpack.config.js /src
RUN npm ci --no-audit

COPY ./src /src/src
RUN BUILD_VERSION=${BUILD_VERSION} npm run build-prod

#########################################################################################
FROM nginxinc/nginx-unprivileged:1.25-alpine3.18-perl

ARG BUILD_VERSION=0.1

LABEL org.opencontainers.image.version=$BUILD_VERSION \
      org.opencontainers.image.authors="airenass@gmail.com" \
      name="stream-transcriber-demo" \
      maintainer="airenass@gmail.com" \
      vendor="airenass@gmail.com" \
      version=$BUILD_VERSION \
      release=$BUILD_VERSION \
      summary="This image is used to start Stream Transcription Demo GUI"

COPY build/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY build/docker/set_env.sh /docker-entrypoint.d/
COPY --from=builder /src/dist /usr/share/nginx/html
# COPY build/docker/index.html /usr/share/nginx/html

USER root

RUN chown nginx:nginx /usr/share/nginx/html/* /usr/share/nginx/html/css/* /usr/share/nginx/html

USER nginx
