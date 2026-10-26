package com.korobki.security.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.security.web.SecurityFilterChain;

import java.util.List;

/**
 * Spring Security configuration.
 * All REST endpoints are currently open (permitAll); HTTP Basic is enabled
 * as a fallback for any request not matched by the whitelist.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * Builds the HTTP security filter chain.
     * Disables CSRF (stateless REST API), applies CORS and permits
     * all whitelisted API and Swagger endpoints.
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
                    "/api/calculations/**",
                    "/api/doc*/**",
                    "/swagger-ui/**",
                    "/swagger-ui.html",
                    "/v3/api-docs/**",
                    "/swagger-resources/**",
                    "/webjars/**"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .httpBasic(Customizer.withDefaults());
        return http.build();
    }

    /**
     * Builds the CORS configuration allowing all origins with credentials.
     *
     * @return permissive CORS configuration source
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
