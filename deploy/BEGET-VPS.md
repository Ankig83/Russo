# Деплой на VPS Beget (ветка `beget`)

Статический сайт: `npm run build` → папка `dist/` → nginx.

## 1. На VPS (один раз)

```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y nginx

sudo mkdir -p /var/www/russo
sudo chown -R $USER:www-data /var/www/russo
```

Скопируй конфиг nginx (замени `YOUR_DOMAIN.ru`):

```bash
sudo cp deploy/nginx-russo.conf /etc/nginx/sites-available/russo
sudo ln -sf /etc/nginx/sites-available/russo /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

SSL (Let's Encrypt):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d YOUR_DOMAIN.ru -d www.YOUR_DOMAIN.ru
```

В панели Beget: привяжи домен к IP VPS (A-запись `@` и `www`).

## 2. С локального ПК (ветка beget)

```bash
git checkout beget
npm ci
npm run build
```

Вариант A — скрипт (нужен SSH-ключ на VPS):

```bash
export DEPLOY_HOST=user@IP_ВАШЕГО_VPS
export DEPLOY_PATH=/var/www/russo
bash deploy/deploy.sh
```

Вариант B — вручную через FileZilla / WinSCP: залей **содержимое** `dist/` в `/var/www/russo/`.

## 3. Проверка

- `https://YOUR_DOMAIN.ru/` — главная с 3D-шкафом
- `https://YOUR_DOMAIN.ru/about` — без 404 (nginx `try_files`)

## Отличия от `master`

| | master | beget |
|---|---|---|
| base URL | `/Russo/` на GitHub Pages | `/` в корне домена |
| роутер | HashRouter на GH Pages | BrowserRouter |
| деплой | GitHub Actions → gh-pages | nginx на VPS |

Для продакшена на Beget всегда работай в ветке **beget**.
