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
| `BEGET_PASSWORD` | пароль root от VPS |

SSH-ключ **не нужен** — только логин и пароль.

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
