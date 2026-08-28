# ПРОМПТ: ПЕРЕНОС HTML-КАЛЬКУЛЯТОРА В ПРОЕКТ

## ЗАДАЧА

Перенести функционал и дизайн HTML-калькулятора (`Стоимость коробки01.html`) в существующий проект со стеком:

- **Backend:** Java 21, Spring Boot 3.3.4, PostgreSQL 15+, Gradle (Kotlin DSL), Flyway
- **Frontend:** React 18 + TypeScript, Vite, Material-UI (MUI)

HTML-файл калькулятора прилагается к этому сообщению.

---

## АРХИТЕКТУРА ПРОЕКТА (PROJECT_STRUCTURE.md)
WebCalc/
├── modules/ # Backend (Gradle multi-project)
│ ├── core/ # Базовые утилиты
│ ├── security/ # Spring Security, JWT (в планах)
│ ├── persistence/ # JPA-сущности, репозитории, Flyway
│ ├── calculator/ # Сервисы расчёта
│ ├── pricing/ # Ценообразование
│ ├── order/ # Заказы и история (пока пусто)
│ ├── construct/ # Управление конструкциями (пока пусто)
│ └── api/ # REST-контроллеры + точка входа
└── frontend/ # React 18 + TS + Vite + MUI
└── src/
├── components/ # (пустые заготовки)
├── hooks/ # (пусто)
├── store/ # (пусто)
└── types/ # (пусто)

text

**Статус:** Backend-модель данных готова, но сервисы расчёта — заглушки. Фронтенд использует mock-данные, API не подключён.

---

## БИЗНЕС-ЛОГИКА (из HTML)

### Алгоритм расчёта цены (в соответствии с НК РФ: скидка → НДС)

1. **Себестоимость коробки** = сумма себестоимостей всех деталей + доп. операции (лак/конгрев/тиснение/печать)
2. **Округление себестоимости** до целого числа [округление #1 — выполняется в CalculatorService]
3. **Базовая цена** (для тиража 10-49) = MIN(Себестоимость × 3, Себестоимость + 30)
4. **Выбор ветки:**
   - Если Себестоимость × 3 < Себестоимость + 30 → ветка **"×3"** (коэффициенты)
   - Иначе → ветка **"+30"** (корректировки в рублях)
5. **Для каждого тиража** — сначала цена БЕЗ НДС (со скидкой), потом НДС:
   - **Ветка "×3"** — цена_без_НДС = Базовая × Коэффициент:

     | Тираж | Коэффициент |
     |-------|-------------|
     | до 9 | 1.0 |
     | 10–49 | 1.0 |
     | 50–199 | 0.95 |
     | 200–499 | 0.90 |
     | 500–699 | 0.85 |
     | 700–1499 | 0.80 |
     | от 1500 | 0.75 |

   - **Ветка "+30"** — цена_без_НДС = Базовая + Корректировка:

     | Тираж | Корректировка |
     |-------|---------------|
     | до 9 | +7 ₽ |
     | 10–49 | 0 ₽ |
     | 50–199 | -2 ₽ |
     | 200–499 | -4 ₽ |
     | 500–699 | -6 ₽ |
     | 700–1499 | -8 ₽ |
     | от 1500 | -10 ₽ |

   - **НДС начисляется ПОСЛЕ скидки:** цена_с_НДС = round(цена_без_НДС × 1.11) [округление #2 — единственное финансовое округление]
6. **Сравнение с прайсом:** если цена_с_НДС < прайсовой → берем ПРАЙСОВУЮ; если больше/равна или прайс = 0 → берем РАСЧЕТНУЮ
7. **Без НДС для отображения:** withoutVAT = цена_без_НДС, округлённая до 2 знаков [округление #3 — только для отображения]

> **Критично (НК РФ):** Скидки/коэффициенты применяются к цене БЕЗ НДС. НДС начисляется ПОСЛЕ скидки. Все расчёты — через BigDecimal. Округление до целого — только при начислении НДС (цена_с_НДС).

---

## БАЗА ДАННЫХ (уже создана, нужно дополнить)

### Существующие таблицы (из V1__create_schema.sql)

- `constructs` (id, name, description, parts JSONB, is_active)
- `materials` (id, name, type, price_per_sheet)
- `operations` (id, name, unit, base_price, price_type)
- `orders`, `order_parts`, `order_operations`, `users`

### Нужно добавить (миграции)

```sql
-- Прайс-листы
CREATE TABLE price_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    construction_name VARCHAR NOT NULL REFERENCES constructs(name),
    price_data JSONB NOT NULL, -- {"до 9": 34, "10–49": 27, ...}
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблицы печати
CREATE TABLE print_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    format_id INTEGER NOT NULL,
    format_name VARCHAR NOT NULL,
    steps JSONB NOT NULL, -- [{"minQty": 100, "price": 5500}, ...]
    step_after_3000 DECIMAL
);
Начальные данные (V2__insert_data.sql)
10 конструкций:

Этне 2 (шубер): {Дно:0, Дно+Разделитель:6, Крышка:0, Крышка с окном:0, Разделитель:0, Дно-лайнер:0, Крышка-лайнер:0, Шубер:30}

Этне 3 (шубер): {Дно:0, Дно+Разделитель:6, Крышка:0, Крышка с окном:0, Разделитель:0, Дно-лайнер:0, Крышка-лайнер:0, Шубер:20}

Элара 4: {Дно:8, Дно+Разделитель:0, Крышка:12, Крышка с окном:0, Разделитель:42, Дно-лайнер:0, Крышка-лайнер:0, Шубер:0}

Этне 5 (шубер): {Дно:0, Дно+Разделитель:4, Крышка:0, Крышка с окном:0, Разделитель:0, Дно-лайнер:0, Крышка-лайнер:0, Шубер:12}

Этне 6 (шубер): {Дно:0, Дно+Разделитель:6, Крышка:0, Крышка с окном:0, Разделитель:0, Дно-лайнер:0, Крышка-лайнер:0, Шубер:6}

Паллена 9: {Дно:6, Дно+Разделитель:0, Крышка:6, Крышка с окном:0, Разделитель:15, Дно-лайнер:0, Крышка-лайнер:0, Шубер:0}

Этне 12 (шубер): {Дно:0, Дно+Разделитель:4, Крышка:0, Крышка с окном:0, Разделитель:0, Дно-лайнер:0, Крышка-лайнер:0, Шубер:6}

Паллена 16: {Дно:4, Дно+Разделитель:0, Крышка:6, Крышка с окном:0, Разделитель:9, Дно-лайнер:0, Крышка-лайнер:0, Шубер:0}

Паллена 25: {Дно:2, Дно+Разделитель:0, Крышка:2, Крышка с окном:0, Разделитель:4, Дно-лайнер:0, Крышка-лайнер:0, Шубер:0}

Атлас: {Дно:1, Дно+Разделитель:0, Крышка:2, Крышка с окном:0, Разделитель:0, Дно-лайнер:0, Крышка-лайнер:0, Шубер:0}

Прайсы — для каждой конструкции по диапазонам (до 9, 10–49, 50–199, 200–499, 500–699, 700–1499, от 1500) — взять из HTML.

Таблицы печати (3 формата):

Формат 1 (до 350×500): 100→5500, 300→7500, 500→9000, 1000→10500, 1500→12000, 2000→13500, 3000→15000, далее +1500/1000шт

Формат 2 (до 500×700): 100→22000, 300→23000, 500→25000, 1000→27000, 1500→29000, 2000→31000, 3000→36000, далее +5000/1000шт

Формат 3 (до 700×1000): 500→31000, 1000→33000, 1500→39000, 2000→49000, 3000→55000, далее +5000/1000шт

BACKEND (Spring Boot)
DTO (создать в modules/api/src/main/java/.../dto/)
java
// CalculationRequest.java
public class CalculationRequest {
    private String construction;
    private List<DetailDto> details;
    private List<ExtraDto> extras;
    private List<ExtraDto> customExtras;
    private PrintSettingsDto printSettings;
    private Double workPrice;
    private Map<String, Double> priceList;
}

// DetailDto
public class DetailDto {
    private String name;
    private Double countOnSheet;
    private Double sheetPrice;
    private Boolean isPrinted;
    private Boolean isCustom;
    private Boolean enabled;
    private Boolean hasLak;
    private Boolean hasCongrev;
    private Boolean hasTisnenie;
}

// ExtraDto
public class ExtraDto {
    private String name;
    private Double cost;
    private Boolean enabled;
    private Boolean isCustom;
}

// PrintSettingsDto
public class PrintSettingsDto {
    private Boolean enabled;
    private Integer format;
    private Integer quantity;
}

// CalculationResponse
public class CalculationResponse {
    private Double totalCost;
    private Double basePrice;
    private String branch;
    private Double basePriceWithVAT;
    private List<PriceRowDto> prices;
}

// PriceRowDto
public class PriceRowDto {
    private String label;
    private Double withoutVAT;
    private Integer calculatedPrice;
    private Integer priceListPrice;
    private Integer finalPrice;
    private Boolean isBase;
    private Boolean isPriceListUsed;
}
Service (modules/calculator/src/main/java/.../service/)
java
@Service
public class CalculatorService {
    
    private static final double VAT_RATE = 0.11;
    private static final double MARKUP_MIN = 30.0;
    private static final double MARKUP_MULTIPLIER = 3.0;
    
    public CalculationResponse calculate(CalculationRequest request) {
        // 1. Расчет полной себестоимости
        double totalCost = calculateTotalCost(request);
        
        // 2. Округление до целого (ЕДИНСТВЕННОЕ ОКРУГЛЕНИЕ!)
        long roundedCost = Math.round(totalCost);
        
        // 3. Базовая цена (для тиража 10-49)
        double basePrice = Math.min(roundedCost * MARKUP_MULTIPLIER, roundedCost + MARKUP_MIN);
        String branch = (roundedCost * MARKUP_MULTIPLIER < roundedCost + MARKUP_MIN) ? "×3" : "+30";
        
        // 4. Базовая цена с НДС (для отображения в ответе)
        long basePriceWithVAT = Math.round(basePrice * (1 + VAT_RATE));
        
        // 5. Генерация цен для всех тиражей (передаём roundedCost, не basePriceWithVAT!)
        //    Внутри generatePrices: скидка → НДС → сравнение с прайсом
        List<PriceRowDto> prices = generatePrices(roundedCost, request.getPriceList());
        
        CalculationResponse response = new CalculationResponse();
        response.setTotalCost(totalCost);
        response.setBasePrice(basePrice);
        response.setBranch(branch);
        response.setBasePriceWithVAT((double) basePriceWithVAT);
        response.setPrices(prices);
        return response;
    }
    
    private double calculateTotalCost(CalculationRequest request) {
        // Реализовать: суммирование деталей + доп. операции + печать
        // Использовать BigDecimal для точности
    }
    
    private int getCorrection(int quantity) {
        if (quantity <= 9) return 7;
        if (quantity <= 49) return 0;
        if (quantity <= 199) return -2;
        if (quantity <= 499) return -4;
        if (quantity <= 699) return -6;
        if (quantity <= 1499) return -8;
        return -10;
    }
    
    private int applyPriceList(int calculatedPrice, int priceListPrice) {
        if (priceListPrice > 0 && calculatedPrice < priceListPrice) {
            return priceListPrice;
        }
        return calculatedPrice;
    }
}
Controller (modules/api/src/main/java/.../controller/)
java
@RestController
@RequestMapping("/api/calculator")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class CalculatorController {
    
    private final CalculatorService calculatorService;
    
    @PostMapping("/calculate")
    public CalculationResponse calculate(@RequestBody CalculationRequest request) {
        return calculatorService.calculate(request);
    }
}
ФРОНТЕНД (React + TypeScript + MUI)
Типы (frontend/src/types/index.ts)
typescript
export interface Detail {
    name: string;
    countOnSheet: number;
    sheetPrice: number;
    isPrinted: boolean;
    isCustom: boolean;
    enabled: boolean;
    hasLak: boolean;
    hasCongrev: boolean;
    hasTisnenie: boolean;
}

export interface Extra {
    name: string;
    cost: number;
    enabled: boolean;
    isCustom?: boolean;
}

export interface PrintSettings {
    enabled: boolean;
    format: number;
    quantity: number;
}

export interface CalculationRequest {
    construction: string;
    details: Detail[];
    extras: Extra[];
    customExtras: Extra[];
    printSettings: PrintSettings;
    workPrice: number;
    priceList: Record<string, number>;
}

export interface PriceRow {
    label: string;
    withoutVAT: number;
    calculatedPrice: number;
    priceListPrice: number;
    finalPrice: number;
    isBase: boolean;
    isPriceListUsed: boolean;
}

export interface CalculationResponse {
    totalCost: number;
    basePrice: number;
    branch: string;
    basePriceWithVAT: number;
    prices: PriceRow[];
}
API (frontend/src/api/calculatorApi.ts)
typescript
import axios from 'axios';
import { CalculationRequest, CalculationResponse } from '../types';

const API_BASE = 'http://localhost:8080/api';

export const calculatorApi = {
    calculate: (data: CalculationRequest): Promise<CalculationResponse> => {
        return axios.post(`${API_BASE}/calculator/calculate`, data)
            .then(res => res.data);
    }
};
Хук (frontend/src/hooks/useCalculator.ts)
Реализовать все состояние и методы из HTML-калькулятора:

construction, details, extras, customExtras, printSettings, workPrice, priceList, result

loadConstruction(name) — загружает конструкцию из DEFAULT_CONSTRUCTIONS

calculate() — отправляет запрос на API

addCustomDetail(), removeCustomDetail(index)

addCustomExtra(), removeCustomExtra(index)

updateDetail(index, field, value)

updateExtra(index, field, value)

updateCustomExtra(index, field, value)

updatePriceList(label, value)

Компоненты (из HTML в MUI)
Перенести дизайн из HTML в React-компоненты с MUI:

ConstructionSelector — Select с названиями коробок

LayoutTable — таблица с колонками:

Чекбокс "Вкл." (enabled)

Название детали (TextField для кастомных)

шт./лист (NumberInput)

руб./лист (NumberInput)

Чекбоксы П/Л/Т/К (Checkbox с буквами)

Кнопка удаления (для кастомных)

Внизу кнопка "Добавить деталь"

ExtrasBlock:

Печать: выбор формата (Select) + тиража (Select) — без чекбокса

Лак/Конгрев/Тиснение: поля стоимости

Кнопка "Добавить операцию" (с названием и стоимостью, без чекбокса)

PriceTable:

Тираж, Без НДС, С НДС, Прайс (NumberInput), Итог

Базовая строка выделена

ImportExport — кнопки для JSON

Стилизация
Цветовая схема: Material Design (#1a73e8 primary)

Шрифт: Roboto (из HTML)

Скругления: 12px, 8px

Тени: как в HTML

Мобильная адаптация: медиа-запросы как в HTML

ПОРЯДОК РАЗРАБОТКИ
База данных → создать миграции для price_lists и print_tables, заполнить данными

Backend → реализовать CalculatorService с полной бизнес-логикой

API → создать эндпоинт POST /api/calculator/calculate

Frontend → перенести верстку из HTML в React-компоненты (MUI)

Интеграция → подключить API через axios, заменить моки на реальные данные

ВАЖНЫЕ ТРЕБОВАНИЯ
Точность расчетов: использовать BigDecimal на бэкенде для избежания ошибок с double

Порядок расчёта (НК РФ): сначала скидка/коэффициент к цене без НДС, потом НДС (× 1.11), потом округление до целого

Округления: (1) себестоимость → целое, (2) цена с НДС → целое [финансовое], (3) withoutVAT для отображения → 2 знака

Дизайн: максимально приблизить к HTML-калькулятору

Чекбокс "Вкл.": при отключении строка становится неактивной (поля disabled, затемнение)

Порядок чекбоксов опций: П (печать), Л (лак), Т (тиснение), К (конгрев)