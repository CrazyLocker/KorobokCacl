plugins {
    id("org.springframework.boot")
}
dependencies {
    implementation(project(":modules:core"))
    implementation(project(":modules:security"))
    implementation(project(":modules:order"))
    implementation(project(":modules:calculator"))
    implementation(project(":modules:pricing"))
    implementation(project(":modules:construct"))
    implementation(project(":modules:persistence")) // ← эта строка важна

    implementation("org.springframework.boot:spring-boot-starter-web:3.3.4")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa:3.3.4")
    implementation("org.springframework.boot:spring-boot-starter-validation:3.3.4")
    implementation("org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0")

    compileOnly("org.projectlombok:lombok:1.18.34")
    annotationProcessor("org.projectlombok:lombok:1.18.34")

    developmentOnly("org.springframework.boot:spring-boot-devtools:3.3.4")
}