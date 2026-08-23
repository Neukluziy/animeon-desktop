# AnimeOn Desktop

### Десктопное приложение AnimeOn для Windows.

AnimeOn Desktop — приложение для Windows, которое позволяет пользоваться сайтом [AnimeOn](https://animeon.cc/) прямо с компьютера.

Программа сделана для более удобного просмотра аниме на ПК.

## Установка

### Установщик

Скачайте установщик из раздела [Releases](../../releases), запустите его и установите AnimeOn Desktop.

### Portable

Скачайте Portable-версию, распакуйте архив и запустите `AnimeOn.exe`.

Portable-версия не требует установки.

## Сборка из исходников

Для самостоятельной сборки AnimeOn Desktop понадобится **Node.js** и **npm**.

### Клонирование репозитория

```bash
git clone https://github.com/Neukluziy/animeon-desktop.git
cd animeon-desktop
```

### Установка зависимостей

Установите все необходимые зависимости проекта:

```bash
npm install
```

### Запуск

Для запуска приложения в режиме разработки:

```bash
npm start
```

### Сборка

Для создания готовой Windows-сборки:

```bash
npm run dist
```

После завершения сборки готовые файлы появятся в папке `dist`.

Проект собирает две версии приложения:

* **NSIS Installer** — обычный установщик Windows.
* **Portable** — версия приложения, которая не требует установки.

Сборка предназначена для **Windows x64**.

## Системные требования

* Windows 10 / 11
* x64

## AnimeOn

Официальные сайты:

* https://animeon.cc
* https://v1.animeon.co

Telegram:

* https://t.me/animeon

> AnimeOn Desktop не является официальным владельцем сайта AnimeOn и разработан отдельно для использования AnimeOn на Windows.
