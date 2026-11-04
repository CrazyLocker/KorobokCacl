package com.korobki.api.controller;

import com.korobki.api.service.CalculationService;
import com.korobki.security.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Проверяет доступ к ручкам расчёта и границы CORS.
 *
 * <p>Альфа-период (m04930): пароля на изменяющих ручках нет — это принятый
 * риск, зафиксированный в {@code docs/alpha-readiness-review.md} как P0-1.
 * Сетевая защита при этом остаётся: чужая страница в браузере не должна
 * получать доступ к API, поэтому preflight с постороннего origin отклоняется.
 */
@WebMvcTest(controllers = CalculationController.class)
@ContextConfiguration(classes = {CalculationController.class, SecurityConfig.class})
class CalculationSecurityTest {

    @Autowired
    private MockMvc mvc;

    @MockBean
    private CalculationService calculationService;

    /**
     * Проверка перед снятием пароля: удаление проходит без учётных данных.
     *
     * @throws Exception on MockMvc failure
     */
    @Test
    void deleteWithoutCredentials_isAccepted() throws Exception {
        UUID id = UUID.randomUUID();

        mvc.perform(delete("/api/calculations/{id}", id))
                .andExpect(status().isOk());

        verify(calculationService).delete(id);
    }

    /**
     * Очистка базы тоже не спрашивает пароль на альфе.
     *
     * @throws Exception on MockMvc failure
     */
    @Test
    void purgeWithoutCredentials_isAccepted() throws Exception {
        mvc.perform(post("/api/calculations/purge")
                        .contentType("application/json")
                        .content("{\"ids\":[]}"))
                .andExpect(status().isOk());

        verify(calculationService).purgeAll(any());
    }

    /**
     * Сохранение расчёта открыто: иначе каждый альфа-тест начинался бы с пароля.
     *
     * @throws Exception on MockMvc failure
     */
    @Test
    void saveWithoutCredentials_isAccepted() throws Exception {
        mvc.perform(post("/api/calculations/save")
                        .contentType("application/json")
                        .content("""
                                {
                                  "name": "Проверка доступа",
                                  "managerName": "Катя",
                                  "calculation": {
                                    "construction": "Паллена 9",
                                    "details": [
                                      {
                                        "name": "Дно",
                                        "countOnSheet": 1,
                                        "sheetPrice": 1,
                                        "partsPerSheetOnPrint": 1,
                                        "isPrinted": false,
                                        "inAssembly": false,
                                        "operations": {}
                                      }
                                    ],
                                    "workPrice": 1
                                  }
                                }
                                """))
                .andExpect(status().isOk());
    }

    @Test
    void listWithoutCredentials_isOpen() throws Exception {
        when(calculationService.list()).thenReturn(List.of());

        mvc.perform(get("/api/calculations/list"))
                .andExpect(status().isOk());
    }

    /**
     * P0-2: чужая страница в браузере не должна получать доступ к API.
     *
     * @throws Exception on MockMvc failure
     */
    @Test
    void preflightFromForeignOrigin_isRejected() throws Exception {
        mvc.perform(options("/api/calculations/save")
                        .header("Origin", "http://evil.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    /**
     * Dev-сервер Vite остаётся разрешённым, иначе локальная разработка встанет.
     *
     * @throws Exception on MockMvc failure
     */
    @Test
    void preflightFromViteDevServer_isAllowed() throws Exception {
        mvc.perform(options("/api/calculations/save")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }
}
