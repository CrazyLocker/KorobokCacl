package com.korobki.api.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.UUID;

/** Client of the reference book. */
@Data
public class CustomerDto {

    /** Client identifier. */
    private UUID id;

    /** Client name. */
    private String name;

    /** Client INN. */
    private String inn;

    /** Contact person / phone / e-mail. */
    private String contact;

    /** Whether the client can still be picked for new calculations. */
    private boolean active;

    /** Creation timestamp. */
    private LocalDateTime createdAt;

    /** Last modification timestamp. */
    private LocalDateTime updatedAt;
}
