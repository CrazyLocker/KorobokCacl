# План: Расчёты, ножи, настройки

## Контекст

- Бэкенд: Java 21, Spring Boot 3.3.4, Gradle (Kotlin DSL), PostgreSQL, Flyway, JPA/Hibernate
- Фронтенд: React 18, TypeScript, Vite, MUI v6, Axios
- Таблица `orders` используется двумя контроллерами (OrderController — заглушка, CalculationStorageService — сохранение расчётов с sessionId в client_name)
- Фронтенд НЕ использует /api/orders (saveOrder/listOrders/getOrder — только объявления)
- Решения пользователя:
  - Клиент и менеджер — простые поля ввода, обязательные при сохранении
  - Список расчётов — накапливается списком во вкладке Настройки, без других функций
  - OrderController удалить, роль переходит в сущность «Расчёты»
  - Импорты/экспорты JSON — во вкладку Настройки
  - Кнопку «Рассчитать» убрать (расчёт автоматический с debounce)
  - Проверить вкладку Справочники (найден баг: ConstructionsTab грузит данные через useState вместо useEffect)

## Шаги

1. [x] **БД: миграции V8–V9**
   - V8: таблица calculations (id UUID, name NOT NULL, client_name NOT NULL, manager_name NOT NULL, status CHECK draft/ready/sent/in_work/closed DEFAULT draft, calculation_state JSONB NOT NULL, created_at, updated_at)
   - V9: таблица knives (id UUID, name NOT NULL, svg_content TEXT NOT NULL, total_length_mm DECIMAL NOT NULL, knife_cost DECIMAL NOT NULL, client_name NOT NULL, manager_name NOT NULL, created_at)
   - Файлы: modules/persistence/src/main/resources/db/migration/V8__create_calculations.sql, V9__create_knives.sql

2. [x] **Бэкенд: сущности + репозитории**
   - Calculation, Knife по конвенциям проекта (UUID gen, Lombok @Data/@NoArgsConstructor/@AllArgsConstructor, явные @Column)
   - Файлы: modules/persistence/.../entity/Calculation.java, Knife.java; repository/CalculationRepository.java, KnifeRepository.java

3. [x] **Бэкенд: API расчётов и ножей, удаление OrderController**
   - CalculationController (/api/calculations): POST save (валидация: name, clientName, managerName обязательны), GET list, GET /{id}, DELETE /{id}
   - KnifeController: POST /save (name, svgContent, результат расчёта), GET list, DELETE /{id}
   - DTO: CalculationSaveRequest (+clientName @NotBlank, +managerName @NotBlank), KnifeSaveRequest
   - Удалить: OrderController, OrderSaveRequest, OrderResponse, CalculationStorageService (переписать на Calculation)
   - Тесты: CalculationControllerTest (валидация, CRUD)
   - Файлы: modules/api/.../controller/*, dto/*, service/*

4. [x] **Фронтенд: API-клиент**
   - calculatorApi: saveCalculation (name, clientName, managerName, calculation), listCalculations, getCalculation, deleteCalculation; saveKnife, listKnives, deleteKnife
   - Удалить методы orders (saveOrder, getOrder, listOrders)
   - Файлы: frontend/src/api/calculatorApi.ts, frontend/src/types/index.ts

5. [x] **Фронтенд: сохранение расчёта с клиентом и менеджером**
   - Кнопка «Сохранить расчёт» в калькуляторе → диалог: название, клиент, менеджер (оба обязательные)
   - Файлы: frontend/src/components/Calculator/SaveCalculationDialog.tsx, frontend/src/App.tsx

6. [x] **Фронтенд: вкладка Настройки**
   - Список сохранённых расчётов (название, клиент, менеджер, статус, дата) — только просмотр
   - Перенести импорт конструкций/прайсов/печати (ImportDataBlock) и экспорт расчётов
   - Убрать блоки импорта/экспорта со страницы калькулятора
   - Файлы: frontend/src/components/Settings/SettingsPage.tsx, frontend/src/App.tsx

7. [x] **Фронтенд: убрать кнопку «Рассчитать»**
   - PriceTable (классический вид), PricesBlock (NewApp)
   - Файлы: frontend/src/components/Calculator/PriceTable.tsx, frontend/src/components/NewApp/PricesBlock.tsx

8. [x] **Фронтенд: проверка вкладки Справочники**
   - Исправить ConstructionsTab: useState → useEffect для начальной загрузки
   - Исправлены также: фиктивная колонка «руб./лист» (убрана), кнопка удаления детали (реализована), выбор конструкции после удаления, каскадное удаление прайс-листа при удалении конструкции (ConstructService)
   - Файлы: frontend/src/components/References/ConstructionsTab.tsx, modules/calculator/.../ConstructService.java, modules/persistence/.../PriceListRepository.java

9. [x] **Финальная проверка: gradlew test + npx tsc --noEmit**
