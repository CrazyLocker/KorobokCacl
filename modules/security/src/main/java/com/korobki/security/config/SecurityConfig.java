package com.korobki.security.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.web.SecurityFilterChain;

import java.util.List;

/**
 * Spring Security configuration.
 *
 * <p>Чтение справочников и расчёт открыты: технологу нужно быстро смотреть
 * данные без логина. Всё, что меняет или удаляет данные (сохранение расчёта,
 * версии, заказы, клиенты, импорт справочников, purge), требует роль ADMIN —
 * это защита от потери истории согласований.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * Builds the HTTP security filter chain.
     *
     * @param http  security builder
     * @param props учётная запись администратора
     * @return configured filter chain
     * @throws Exception on configuration error
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, AdminProperties props) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeHttpRequests(auth -> auth
                // Проверка пароля администратора: нужна роль, иначе фронт не поймёт, верен ли пароль.
                .requestMatchers("/api/auth/me").hasRole("ADMIN")
                // Справочники, расчёт и просмотр истории — открыты.
                .requestMatchers(HttpMethod.GET, "/api/**").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/api/**").permitAll()
                // Всё остальное по API — только администратор.
                .requestMatchers("/api/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            .httpBasic(Customizer.withDefaults());
        return http.build();
    }

    /**
     * Единственная учётная запись администратора из настроек.
     *
     * <p>Свой менеджер пользователей отключает сгенерированный Spring пароль:
     * иначе приложение печатает случайный пароль в консоль при каждом старте.
     *
     * @param props настройки администратора
     * @return менеджер с одной учётной записью
     */
    @Bean
    public InMemoryUserDetailsManager userDetailsService(AdminProperties props) {
        UserDetails admin = User.withUsername(props.getAdminUser())
                .password("{noop}" + props.getAdminPassword())
                .roles("ADMIN")
                .build();
        return new InMemoryUserDetailsManager(admin);
    }

    /**
     * Builds the CORS configuration.
     *
     * <p>Разрешён только dev-сервер Vite: иначе любая открытая в браузере
     * страница могла бы дёргать API и читать ответы от имени пользователя.
     * В продакшене фронт раздаётся с того же адреса, и CORS не нужен вовсе.
     *
     * @return CORS configuration source
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173", "http://127.0.0.1:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
