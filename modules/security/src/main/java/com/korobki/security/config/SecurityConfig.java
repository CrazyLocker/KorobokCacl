package com.korobki.security.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Spring Security configuration.
 *
 * <p>Все REST-эндпоинты открыты: альфа-тест идёт на чистой базе, на локальной
 * машине, одним пользователем — пароль на изменяющие ручки давал больше трения,
 * чем пользы. Это принятый риск, зафиксированный в
 * {@code docs/alpha-readiness-review.md} (P0-1); перед работой с данными,
 * которые нельзя потерять, аутентификацию нужно вернуть точечно (коммит
 * {@code 50792b6} в истории).
 *
 * <p>Защита от сетевой экспозиции при этом остаётся: сервер слушает только
 * петлевой интерфейс ({@code server.address=127.0.0.1}) и CORS пускает лишь
 * dev-сервер Vite. HTTP Basic включён как фолбэк для запросов вне API.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * Builds the HTTP security filter chain.
     *
     * <p>CSRF отключён: API stateless, без сессионных cookie.
     *
     * @param http security builder
     * @return configured filter chain
     * @throws Exception on configuration error
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/api/constructs/**",
                    "/api/operations/**",
                    "/api/calculator/**",
                    "/api/print-tables/**",
                    "/api/price-lists/**",
                    "/api/knife/**",
                    "/api/references/**",
                    "/api/orders/**",
                    "/api/customers/**",
                    "/api/calculations/**",
                    "/api/doc/**"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .httpBasic(Customizer.withDefaults());
        return http.build();
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
