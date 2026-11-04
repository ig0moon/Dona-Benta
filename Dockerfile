FROM php:8.3-apache

ENV CI_ENVIRONMENT=production \
    PORT=10000

RUN apt-get update \
    && apt-get install -y --no-install-recommends libicu-dev libcurl4-openssl-dev libonig-dev \
    && docker-php-ext-install curl intl mbstring mysqli pdo_mysql \
    && a2enmod rewrite headers \
    && sed -ri 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/000-default.conf \
    && sed -ri 's/AllowOverride None/AllowOverride All/' /etc/apache2/apache2.conf \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

RUN printf 'upload_max_filesize=9M\npost_max_size=10M\n' > /usr/local/etc/php/conf.d/uploads.ini

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-progress \
    --prefer-dist \
    --optimize-autoloader

COPY . .

RUN chown -R www-data:www-data writable

EXPOSE 10000

CMD ["sh", "-c", "sed -i \"s/^Listen 80$/Listen ${PORT}/\" /etc/apache2/ports.conf && sed -i \"s#<VirtualHost .*:80>#<VirtualHost *:${PORT}>#\" /etc/apache2/sites-available/000-default.conf && exec apache2-foreground"]
