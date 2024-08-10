# C4U CRM

C4U CRM — это система управления взаимоотношениями с клиентами (CRM), разработанная для управления полным жизненным циклом клиента. Этот проект создан на основе технологий Node.js и MongoDB и предлагает простую и интуитивно понятную платформу для управления клиентами, заказами и бонусными программами.

## Основные возможности
- **Регистрация клиентов**: Возможность добавления новых клиентов с указанием их данных.
- **Создание заказов**: Управление заказами и автоматическое начисление бонусов за каждый заказ.
- **Просмотр информации о клиенте**: Получение полной информации о клиенте, включая историю заказов и бонусный баланс.
- **Поддержка ролей пользователей**: Разделение прав доступа на роли (администратор, менеджер, клиент).

## Установка

### Предварительные требования
Для запуска проекта на вашем компьютере необходимы:
- Node.js 14.x или выше
- MongoDB 4.x или выше
- Git

### Шаги по установке

1. **Клонирование репозитория:**
    ```bash
    git clone https://github.com/Degradin/c4u-crm.git
    cd c4u-crm
    ```

2. **Установка зависимостей:**
    ```bash
    npm install
    ```

3. **Создание файла окружения:**
   Скопируйте файл `.env.example` и создайте файл `.env`:
    ```bash
    cp .env.example .env
    ```
   Затем откройте файл `.env` и настройте переменные окружения, включая параметры подключения к MongoDB и токен для бота Telegram.

4. **Запуск MongoDB:**
    Убедитесь, что MongoDB запущена и доступна по адресу, указанному в файле `.env`.

5. **Инициализация базы данных:**
    Выполните инициализацию базы данных:
    ```bash
    npm run init-db
    ```

6. **Запуск приложения:**
    ```bash
    npm start
    ```

## Использование

- **Регистрация клиента:** В Telegram бот отправляет запрос на ввод номера телефона, после чего добавляет клиента в базу данных.
- **Создание заказа:** Пользователь с соответствующими правами может создать заказ для клиента, указав номер телефона и сумму заказа.
- **Просмотр информации о клиенте:** Введите команду для поиска клиента по номеру телефона, чтобы получить полную информацию о клиенте.

## Contributing
Если вы хотите внести свой вклад в проект, пожалуйста, форкните репозиторий и создайте Pull Request. Будем рады любым улучшениям!

## Лицензия
Этот проект лицензирован под [MIT License](LICENSE).

