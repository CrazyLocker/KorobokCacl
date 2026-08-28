rootProject.name = "korobki-calculator"

include(
    "modules:core",
    "modules:security",
    "modules:persistence",
    "modules:calculator",
    "modules:pricing",
    "modules:order",
    "modules:construct",
    "modules:api"
)

// Для IntelliJ
project(":modules:core").name = "core"
project(":modules:security").name = "security"
project(":modules:persistence").name = "persistence"
project(":modules:calculator").name = "calculator"
project(":modules:pricing").name = "pricing"
project(":modules:order").name = "order"
project(":modules:construct").name = "construct"
project(":modules:api").name = "api"
