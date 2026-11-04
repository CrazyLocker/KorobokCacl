package com.korobki.security.config;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Учётная запись администратора для изменяющих запросов.
 *
 * <p>Чтение справочников и расчёт открыты, а всё, что пишет или удаляет
 * данные, требует роль ADMIN: случайное нажатие «Удалить навсегда» не должно
 * стирать историю согласований. Пароль задаётся переменной окружения
 * {@code ALPHA_ADMIN_PASSWORD} и не хранится в репозитории.
 */
@Component
@ConfigurationProperties(prefix = "app.security")
public class AdminProperties {

    /** Имя единственной учётной записи администратора. */
    private String adminUser = "admin";

    /** Пароль администратора; обязан быть задан окружением. */
    private String adminPassword = "";

    /**
     * Проверяет, что пароль задан.
     *
     * <p>Приложение не должно стартовать с пустым паролем: иначе защищённые
     * ручки остаются открытыми, а сгенерированный Spring пароль печатается
     * в консоль, где его никто не сохранит.
     *
     * @throws IllegalStateException если {@code ALPHA_ADMIN_PASSWORD} не задан
     */
    @PostConstruct
    void requirePassword() {
        if (adminPassword == null || adminPassword.isBlank()) {
            throw new IllegalStateException(
                    "Не задан пароль администратора: установите переменную окружения "
                            + "ALPHA_ADMIN_PASSWORD перед запуском бэкенда");
        }
    }

    public String getAdminUser() {
        return adminUser;
    }

    public void setAdminUser(String adminUser) {
        this.adminUser = adminUser;
    }

    public String getAdminPassword() {
        return adminPassword;
    }

    public void setAdminPassword(String adminPassword) {
        this.adminPassword = adminPassword;
    }
}
