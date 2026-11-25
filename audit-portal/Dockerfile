FROM composer:2 AS composer
FROM php:8.4-fpm-alpine

WORKDIR /app
COPY --from=composer /usr/bin/composer /usr/local/bin/composer
COPY composer.json composer.lock ./
RUN COMPOSER_ALLOW_SUPERUSER=1 composer install --no-dev --no-interaction --prefer-dist

COPY public ./public
COPY src ./src
RUN printf '%s\n' '[www]' 'env[ZENIT_ISSUER] = $ZENIT_ISSUER' \
    'env[ZENIT_API_URL] = $ZENIT_API_URL' 'env[ZENIT_PORTAL_URL] = $ZENIT_PORTAL_URL' \
    'env[ZENIT_CLIENT_ID] = $ZENIT_CLIENT_ID' 'env[ZENIT_TOKEN_URL] = $ZENIT_TOKEN_URL' \
    > /usr/local/etc/php-fpm.d/zenit-audit.conf
