package com.korobki.api.controller;

import com.korobki.security.config.AdminProperties;
import com.korobki.security.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Проверка ручки, которой фронтенд валидирует пароль администратора.
 */
@WebMvcTest(controllers = AuthController.class)
@ContextConfiguration(classes = {AuthController.class, SecurityConfig.class, AdminProperties.class})
@TestPropertySource(properties = {
        "app.security.admin-user=admin",
        "app.security.admin-password=secret",
})
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    /**
     * Без пароля проверка должна отвечать 401, иначе фронт не отличит
     * неверный пароль от верного.
     *
     * @throws Exception on MockMvc failure
     */
    @Test
    void me_withoutCredentials_isUnauthorized() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * С верной учётной записью ручка отдаёт логин администратора.
     *
     * @throws Exception on MockMvc failure
     */
    @Test
    void me_withAdminRole_returnsUser() throws Exception {
        mockMvc.perform(get("/api/auth/me")
                        .with(SecurityMockMvcRequestPostProcessors.user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user").value("admin"));
    }
}
