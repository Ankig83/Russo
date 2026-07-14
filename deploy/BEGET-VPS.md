# Деплой на VPS Beget (ветка `beget`)

**Автоматически:** push в ветку `beget` → GitHub Actions собирает `dist/` и заливает на сервер.

Ручная загрузка файлов **не нужна**.

---

## 1. Секреты в GitHub (один раз)

**github.com/Ankig83/Russo → Settings → Secrets and variables → Actions → New repository secret**

| Secret | Значение |
|--------|----------|
| `BEGET_HOST` | `93.189.229.230` |
| `BEGET_USER` | `root` |
| `BEGET_PASSWORD` | пароль root от VPS (символы `!&` и т.п. — ок, вставлять как есть) |

SSH-ключ **не нужен**. Старые секреты `BEGET_SSH_KEY` / `BEGET_KNOWN_HOSTS` можно удалить.

**Куда:** [github.com/Ankig83/Russo/settings/secrets/actions](https://github.com/Ankig83/Russo/settings/secrets/actions)

---

## 2. Как деплоить

```bash
git checkout beget
git add .
git commit -m "..."
git push origin beget
```

GitHub → **Actions** → **Deploy to Beget VPS** — зелёная галочка = сайт обновлён.

Или: Actions → **Run workflow** (кнопка вручную).

---

## 3. Проверка

`http://93.189.229.230`

---

## 4. Если Actions падает на «Upload dist to VPS»

**Сборка (`npm ci` + `npm run build`) проходит — проблема в SSH, не в коде.**

### Диагностика

1. GitHub → Actions → упавший run → шаг **Test SSH to VPS** — там будет текст ошибки.
2. С ПК проверь порт 22:
   ```powershell
   Test-NetConnection 93.189.229.230 -Port 22
   ```
   Если `TcpTestSucceeded : False` — SSH снаружи закрыт, Actions тоже не достучится.

### Что сделать на VPS (через консоль Beget / VNC)

```bash
# sshd запущен?
systemctl status ssh

# firewall — порт 22 открыт для входящих
ufw allow 22/tcp
ufw status

# или в панели Beget: VPS → Firewall → разрешить SSH (22)
```

После открытия порта: Actions → **Re-run all jobs**.

### Секреты GitHub (если «Secret … не задан»)

| Secret | Значение |
|--------|----------|
| `BEGET_HOST` | `93.189.229.230` |
| `BEGET_USER` | `root` |
| `BEGET_PASSWORD` | пароль root от VPS |

Старые `BEGET_SSH_KEY` / `BEGET_KNOWN_HOSTS` — не используются, можно удалить.

---

## 5. Ручной деплой (если SSH с ПК работает, а Actions — нет)

```bash
npm ci && npm run build
rsync -avz --delete dist/ root@93.189.229.230:/var/www/russo/
```

На Windows — через WSL или Git Bash (нужен rsync + ssh).

---

## Ветки

| Ветка | Куда |
|-------|------|
| `beget` | VPS Beget (авто) |
| `master` | GitHub Pages |

Для Beget работай в ветке **`beget`**.

---

## VPS (уже настроено)

- nginx → `/var/www/russo`
- ufw: 22, 80, 443

Если Actions падает с **timeout** — на сервере должен быть открыт **SSH порт 22** для входящих (ufw allow 22). GitHub подключается с интернета, не с твоего ПК.
