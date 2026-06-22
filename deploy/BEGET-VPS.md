# Деплой на VPS Beget (ветка `beget`)

**Автоматически:** push в ветку `beget` → GitHub Actions собирает `dist/` и заливает на сервер по SSH.

Ручная загрузка файлов **не нужна**.

---

## 1. На VPS (один раз)

nginx, папка, ufw — как уже настроено:

```bash
mkdir -p /var/www/russo
chown -R www-data:www-data /var/www/russo
```

---

## 2. SSH-ключ для GitHub Actions (один раз)

### На своём ПК (PowerShell)

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\beget_deploy -N '""'
```

Появятся:
- `beget_deploy` — приватный (в GitHub Secrets)
- `beget_deploy.pub` — публичный (на сервер)

### Публичный ключ на сервер (VNC)

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
```

Вставь **одну строку** из `beget_deploy.pub`, сохрани.

```bash
chmod 600 ~/.ssh/authorized_keys
```

---

## 3. Секреты в GitHub

Репозиторий **Ankig83/Russo** → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Имя | Значение |
|-----|----------|
| `BEGET_HOST` | `93.189.229.230` |
| `BEGET_USER` | `root` |
| `BEGET_SSH_KEY` | весь текст файла `beget_deploy` (приватный ключ) |

---

## 4. Как деплоить дальше

```bash
git checkout beget
# правки...
git add .
git commit -m "..."
git push origin beget
```

GitHub → **Actions** → **Deploy to Beget VPS** — зелёная галочка = сайт обновлён.

Или в Actions нажми **Run workflow** вручную.

---

## 5. Проверка

`http://93.189.229.230` — шкаф должен открываться.

---

## Ветки

| Ветка | Куда деплоится |
|-------|----------------|
| `beget` | VPS Beget (авто по SSH) |
| `master` | GitHub Pages (если включено) |

Для продакшена на Beget работай в **`beget`**.
