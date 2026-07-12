---
status: accepted
---

# Split Next frontend from Nest backend download lifecycle

We will use Next.js for the user-facing frontend and keep the Nest backend as the owner of video job intake, worker processing, storage, cleanup, sessions, quotas, migrations, and operational health. A full Next standalone port was rejected because this product depends on long-running yt-dlp work, queue consumption, R2 upload/delete, reservation reconciliation, and cleanup scheduling; those behaviours need a backend and worker runtime with a deep Download lifecycle module rather than shallow route handlers.
