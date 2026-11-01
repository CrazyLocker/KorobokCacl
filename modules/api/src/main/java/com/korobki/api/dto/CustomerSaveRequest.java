package com.korobki.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** Request DTO for creating or renaming a client. */
@Data
public class CustomerSaveRequest {

    /** Client name, unique ignoring case. */
    @NotBlank(message = "Укажите название клиента")
    @Size(max = 200, message = "Название клиента — не длиннее 200 символов")
    private String name;

    /** Client INN, optional. */
    @Size(max = 20, message = "ИНН — не длиннее 20 символов")
    private String inn;

    /** Contact person / phone / e-mail, optional. */
    @Size(max = 200, message = "Контакт — не длиннее 200 символов")
    private String contact;

    /** Whether the client can still be picked for new calculations. */
    private Boolean active;
}
