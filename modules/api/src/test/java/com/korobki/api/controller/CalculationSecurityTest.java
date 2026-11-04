package com.korobki.api.controller;

import com.korobki.api.service.CalculationService;
import com.korobki.security.config.AdminProperties;
import com.korobki.security.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Проверяет, что удаление и очистка закрыты паролем, а чтение открыто.
 *
 * <p>P0-1 из docs/alpha-readiness-review.md: без аутентификации любая
 * страница в сети могла стереть историю согласований.
 */
@WebMvcTest(controllers = CalculationController.class)
@ContextConfiguration(classes = {CalculationController.class, SecurityConfig.class, AdminProperties.class})
@TestPropertySource(properties = {
        "app.security.admin-user=admin",
        "app.security.admin-password=secret",
})
class CalculationSecurityTest {

    @Autowired
    private MockMvc mvc;

    @MockBean
    private CalculationService calculationService;

    @Test
    void deleteWithoutCredentials_isUnauthorized() throws Exception {
        mvc.perform(delete("/api/calculations/{id}", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());

        verify(calculationService, never()).delete(any());
    }

    @Test
    void purgeWithoutCredentials_isUnauthorized() throws Exception {
        mvc.perform(post("/api/calculations/purge")
                        .contentType("application/json")
                        .content("{\"ids\":[]}"))
                .andExpect(status().isUnauthorized());

        verify(calculationService, never()).purgeAll(any());
    }

    @Test
    void listWithoutCredentials_isOpen() throws Exception {
        when(calculationService.list()).thenReturn(List.of());

        mvc.perform(get("/api/calculations/list"))
                .andExpect(status().isOk());
    }

    @Test
    void deleteWithAdminCredentials_isAccepted() throws Exception {
        UUID id = UUID.randomUUID();

        mvc.perform(delete("/api/calculations/{id}", id).with(httpBasic("admin", "secret")))
                .andExpect(status().isOk());

        verify(calculationService).delete(id);
    }

    @Test
    void deleteWithWrongPassword_isUnauthorized() throws Exception {
        mvc.perform(delete("/api/calculations/{id}", UUID.randomUUID())
                        .with(httpBasic("admin", "wrong")))
                .andExpect(status().isUnauthorized());
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


