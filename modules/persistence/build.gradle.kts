dependencies {
    implementation(project(":modules:core"))

    implementation("org.springframework.boot:spring-boot-starter-data-jpa:3.3.4")
    implementation("org.postgresql:postgresql:42.7.3")
    implementation("org.flywaydb:flyway-core:10.17.3")
    implementation("org.flywaydb:flyway-database-postgresql:10.17.3")

    // Добавьте Lombok
    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")
}