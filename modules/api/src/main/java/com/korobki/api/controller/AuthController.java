package com.korobki.api.controller;

import org.springframework.http.ResponseEntity;
import java.security.Principal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Проверка учётной записи администратора.
 *
 * <p>Нужна фронтенду перед опасным действием: интерфейс спрашивает пароль один
 * раз и проверяет его этим запросом, чтобы не показывать пользователю ошибку
 * уже после нажатия «Удалить из базы».
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    /**
     * Отдаёт имя вошедшего администратора.
     *
     * <p>Доступ закрыт ролью ADMIN в {@code SecurityConfig}: без верного пароля
     * запрос получает 401.
     *
     * @param principal текущий пользователь (гарантированно ADMIN)
     * @return имя пользователя
     */
    @GetMapping("/me")
    public ResponseEntity<Map<String, String>> me(Principal principal) {
        return ResponseEntity.ok(Map.of("user", principal.getName()));
    }
}



