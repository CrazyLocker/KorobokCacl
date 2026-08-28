package com.korobki.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

@SpringBootApplication(scanBasePackages = "com.korobki")
@EntityScan("com.korobki.persistence.entity")
@EnableJpaRepositories("com.korobki.persistence.repository")
public class KorobkiApplication {
    public static void main(String[] args) {
        SpringApplication.run(KorobkiApplication.class, args);
    }
}