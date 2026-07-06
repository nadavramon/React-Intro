# Welcome mail via a queue (RabbitMQ) — Design

**Date:** 2026-07-06
**Status:** Spec'd
**Assignment:** The moment a user signs up, they receive a welcome email **asynchronously, through a message queue** — sent **exactly once**. Phases: (1) run RabbitMQ in Docker; (2) publish a message `{ userId, email }` during registration; (3) a consumer listens and sends the welcome mail; (4) guarantee every user is mailed exactly once — the right/best-practice way; (5) ack only **after** the mail was sent successfully. Learning goals: message queues, at-least-once delivery, idempotency, and where the ack belongs.

---

## The three questions this assignment turns on

These aren't side-notes — they are the design. Answering them dictates every structural choice below.

### 1. Why send the mail through a queue instead of inline in the registration request?

Because sending the mail and creating the account are two different jobs with different failure modes, and coupling them makes the important one (create the account) hostage to the flaky one (talk to an SMTP server).

- **Decoupling / correctness.** Sign-up's job is "create the user." If the mailer is slow or down and the send is inline, the user's sign-up either **hangs** or **fails** — for a side-effect that has nothing to do with whether the account exists. Through a queue, the account is created and the request returns; the mail is a downstream reaction that can take its time.
- **Latency.** An SMTP handshake is hundreds of ms to seconds. Inline, the user waits for it. Publishing to a local broker is sub-millisecond, so sign-up latency stays flat.
- **Resilience / retry.** If an inline send fails, the mail is simply lost (or you fail the whole request). A queue **redelivers** until a consumer confirms success — retry is built into the transport, not something we hand-roll in the request handler.
- **Load-smoothing (backpressure).** A burst of sign-ups becomes a burst of tiny publishes, not a burst of synchronous SMTP connections. The consumer drains the queue at its own pace (prefetch-limited) instead of the SMTP server being hammered in lock-step with traffic.

### 2. RabbitMQ is at-least-once — when can the consumer receive the same message twice, and how do we avoid a duplicate mail?

**When a duplicate arrives:** RabbitMQ redelivers whenever it does **not** receive an ack for a delivered message. Concretely:

- The consumer **sends the mail, then crashes (or the connection drops) before the ack reaches the broker.** On reconnect the broker redelivers — the same mail gets sent again. **Phase 5 ("ack only after send") deliberately creates this window.** That's the point of the exercise.
- The **ack is lost in flight** (a network blip) even though the mail was sent — broker never heard the ack, redelivers.
- The channel closes / the consumer nacks with requeue → the unacked message is requeued and redelivered.

So "ack after send" buys **at-least-once**: the mail is never lost, but it *can* be sent twice. Note the honest ceiling up front: **true end-to-end exactly-once is impossible** here — email has no distributed transaction, so there is no atomic "send the mail AND record that we sent it." What we actually build is **at-least-once transport + an idempotent consumer = *effectively once***.

**How we avoid the duplicate — idempotency keyed on a stable business key.**

- **Idempotency key = `userId`.** It rides *in the message* (so it's identical across redeliveries) and it encodes the business rule directly: *one welcome mail per user, ever.*
- **Durable dedup record in Mongo, with a unique index on `userId`.** Durable matters: the record must outlive process restarts and never be silently dropped. **Redis is the wrong store here** — it can be flushed or evict a key, and a lost dedup key means a second welcome mail. The Mongo unique index also makes the "claim" **atomic and race-safe by construction**: two concurrent deliveries for a new user can't both win — one insert succeeds, the other loses. That "insert-or-lose" is the intuition; Phase 4 refines it into a two-state upsert that *reads* the existing record and branches on its status (already-`sent` → skip, `pending` → resend), so the store guarantees **state** correctness while the consumer's control flow (including catching the loser's duplicate-key error and treating it as *skip*) is what turns that into no-duplicate behavior.

The exact record shape and state machine are Phase 4.

### 3. What if the send fails — when do we ack, and when not?

The ack is the queue's contract: *"this work is done, drop the message."* So the rule is literally "don't ack until the mail is actually out."

- **Send succeeds** → **`ack`** (this is the *only* place we ack a sent mail — Phase 5).
- **Transient failure** (SMTP timeout / mailer down / connection refused) → **do not ack** → **`nack(requeue)`**, so the broker redelivers and we try again. Bounded by an attempt cap (below) so it can't retry forever.
- **Permanent failure** (malformed message, invalid recipient / hard SMTP 5xx, or attempts exhausted) → **`nack(requeue=false)`** → the message is **dead-lettered to a DLQ** (a parking lot). A poison message must not hot-loop the consumer forever; we park it and inspect it in the RabbitMQ management UI.

---

## Decisions (locked with Nadav)

1. **Sign-up seam = better-auth `databaseHooks.user.create.after`.** There is no hand-written registration controller — better-auth owns sign-up. This hook fires **once per newly-created user, for both email/password and Google**, which is exactly "the moment a user signs up." The hook **only publishes** to the queue; it never sends mail inline. (It fires at user-row creation with `emailVerified: false`, *before* any verification-email step. Verification is not enabled today — `auth.ts` has `emailAndPassword: { enabled: true }` only — so this is moot; if it's ever turned on, the welcome mail would precede verification, so revisit this seam then.)
2. **Exactly-once = at-least-once transport + idempotent consumer.** Durable Mongo dedup record, unique index on `userId`, **two-state** (`pending → sent`) claim. The claim is a plain `{ userId }` upsert that **returns** the record and branches on its status (not a `status: {$ne:'sent'}` conditional upsert — that form *throws E11000* on an already-sent user instead of returning it; see Phase 4). Chosen over the simpler variants because it is simultaneously race-safe, no-loss, *and* duplicate-free except for the two irreducible windows (below). Matches the "full best-practice" goal.
3. **Mail transport = Mailpit** (a Docker SMTP sink with a web inbox at `:8025`, the maintained successor to MailHog) driven by **nodemailer**. We can *see* the welcome mail arrive, which makes the exactly-once property verifiable — not just asserted. No external accounts, no secrets.
4. **Consumer runs in the same server process,** started at boot next to `connectRabbitMQ()`. A separate worker deployable is the scaling path — out of scope, YAGNI for a one-server learning app.
5. **Hardening included:** durable queue + persistent messages + publisher confirms, a Dead-Letter Queue for poison messages, bounded retries, and graceful degradation (a down broker at publish time must not break sign-up).
6. **Client `apps/web` is untouched.** This is a server-side feature end to end.

---

## Architecture & components

New `modules/mail/` feature plus one shared-config file, mirroring how `redis.ts` wires an external service. Split deliberately so the **exactly-once logic is a plain unit-testable function** with no live broker:

```
apps/server/
  docker-compose.yml              + rabbitmq (broker :5672, mgmt UI :15672), + mailpit (SMTP :1025, UI :8025)
  .env.example / .env/.env.dev    + RABBITMQ_URL, SMTP_HOST, SMTP_PORT, MAIL_FROM
  src/
    shared/config/
      env.ts                      EDIT + RABBITMQ_URL, SMTP_HOST, SMTP_PORT, MAIL_FROM
      rabbitmq.ts        NEW  connection + channels + topology assert + own reconnect loop; connect/disconnect (see Phase 3)
      auth.ts            EDIT databaseHooks.user.create.after → publishWelcomeEmail(...)
    modules/mail/
      welcomeEmail.schema.ts       NEW  Mongoose dedup model: { userId (String, unique), email, status, attempts, sentAt, lastError }
      mailer.ts                    NEW  nodemailer → Mailpit; sendWelcomeEmail(email, name)
      welcomeMail.publisher.ts     NEW  publish {userId,email,name}; confirm channel + persistent
      welcomeMail.consumer.ts      NEW  subscribe, prefetch(1); translate result → ack / nack / DLQ
      welcomeMail.service.ts       NEW  processWelcomeMessage() — the idempotent core (unit-tested)
      welcomeMail.service.test.ts  NEW
    index.ts               EDIT connectRabbitMQ() + startWelcomeConsumer(); disconnect on SIGINT/SIGTERM
```

- **Library:** `amqplib` (the standard Node RabbitMQ client) + `nodemailer`, plus `@types/amqplib` and `@types/nodemailer` as dev deps. (`import amqp from 'amqplib'; amqp.connect(...)` typechecks cleanly under this package's `module: nodenext` — amqplib's default export is a namespace you read `.connect` off of, so it does *not* trip the CJS-default-constructor gotcha that `ioredis` does.)
- **Isolation boundary:** `welcomeMail.service.ts` holds *all* the exactly-once decision logic and depends only on the Mongoose model + `mailer` (both mockable). `welcomeMail.consumer.ts` is thin AMQP glue that parses the message, calls the service, and maps its result to `ack`/`nack`. `welcomeMail.publisher.ts` is the only writer to the queue. Each has one job and a clean seam.
- **Convention:** relative imports carry explicit `.ts` extensions (`./env.ts`, `../shared/utils/logger.ts`) — required by this package's `module: nodenext` + `rewriteRelativeImportExtensions: true`; every existing server import follows this and extensionless relative imports fail typecheck.
- **Channel ownership:** `rabbitmq.ts` owns the connection and hands out channels — the **publisher opens its own confirm channel** (`createConfirmChannel`) and the **consumer its own channel** with `prefetch(1)`. Publisher confirms and consumer prefetch are per-channel, so they cannot share one channel.

---

## Phase 1 — RabbitMQ (and Mailpit) in Docker

Extend the existing `apps/server/docker-compose.yml` (which already runs Redis):

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management-alpine   # -management = ships the web UI + CLI
    ports:
      - '5672:5672'      # AMQP (the app connects here)
      - '15672:15672'    # management UI — inspect queues, DLQ, message rates
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq    # durable queues survive a container restart
  mailpit:
    image: axllent/mailpit:v1.30   # pinned like rabbitmq — keeps the REST API contract stable
    ports:
      - '1025:1025'      # SMTP sink (nodemailer connects here)
      - '8025:8025'      # web inbox — watch the welcome mail land
volumes:
  rabbitmq-data:
```

`docker compose up -d` from `apps/server/`. Management UI at <http://localhost:15672> (guest/guest), Mailpit inbox at <http://localhost:8025>.

## Phase 2 — Publish on sign-up (`auth.ts` hook + publisher)

**`auth.ts`** gains a `databaseHooks` block:

```ts
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        // The user row is ALREADY COMMITTED before this hook runs — better-auth
        // queues create.after after the write, and with transaction:false there is
        // no DB transaction at all. So an uncaught throw here does NOT roll the user
        // back; it fails the sign-up *request* (500 / broken OAuth redirect) even
        // though the account exists — better-auth drains create.after in a per-request
        // loop with no try/catch. Therefore this hook must NEVER throw: publishWelcomeEmail
        // swallows all publish errors (broker down, confirm timeout) and resolves to void.
        await publishWelcomeEmail({ userId: user.id, email: user.email, name: user.name });
      },
    },
  },
},
```

**`welcomeMail.publisher.ts`** publishes `{ userId, email, name }` as JSON with:

- **Persistent messages** (`{ persistent: true }`, delivery-mode 2) — so a published mail survives a broker restart, paired with the durable queue.
- **Publisher confirms** (`createConfirmChannel`): `sendToQueue(queue, body, { persistent: true })` **then `await channel.waitForConfirms()`**. Note `sendToQueue`/`publish` return a flow-control **boolean**, not a promise — the confirmation arrives via `waitForConfirms()` (resolves once the broker has *accepted* every outstanding publish on the channel), so don't `await` the return of `sendToQueue`. That's how we know the message actually landed rather than assuming.
- **A timeout + try/catch** inside the publisher: if the broker is unreachable **or `waitForConfirms()` rejects (a broker `basic.nack`)**, log an error and resolve to void so the hook never throws and sign-up still succeeds. **Named gap:** the welcome mail for *that one user* is then lost. Closing it fully needs the **transactional-outbox** pattern (write an outbox row in the same DB transaction as the user, a relay publishes it) — which would also require flipping `transaction: true` in `auth.ts`; a large jump in complexity, explicitly out of scope (see below).
- **`name` is always a `string` but may be `''`.** better-auth's email/password sign-up validates `name` with `z.string()` (no non-empty constraint, unlike `password`) and passes it straight through, so `name: ''` is a valid user row; the client form's `required` is not a server trust boundary, and a Google profile without a display name is possible too. So `name` is safe to put in the message body (never `undefined`), but **`mailer.ts` must fall back to a generic greeting** (`name.trim() || 'there'`) rather than render "Hi ,".

## Phase 3 — Consumer / worker (`welcomeMail.consumer.ts` + boot wiring)

- `channel.prefetch(1)` — one unacked message at a time; the consumer fully finishes (send + ack) before taking the next. This bounds concurrency to one, so a single consumer never runs two SMTP sends in parallel. **Note it is *not* the dedup mechanism:** prefetch is a per-consumer QoS limit with no cross-consumer mutual exclusion (multiple consumers at `prefetch(1)` can still deliver the same `userId` concurrently). The sole race-safety guarantee is the atomic unique-index claim on `userId` (Phase 4) — which is exactly why the design stays correct under scale-out. Likewise, RabbitMQ does **not** guarantee ordering across a requeue (`nack(requeue=true)` returns the message toward the head best-effort, not to its original position) — fine here, since each message is an independent, idempotent per-`userId` job that doesn't depend on delivery order.
- `channel.consume(WELCOME_QUEUE, handler, { noAck: false })` — manual ack mode; the broker holds the message until we ack/nack.
- The handler parses the JSON body, calls `processWelcomeMessage(...)`, and maps the returned action to `channel.ack` / `channel.nack(msg, false, true)` (requeue) / `channel.nack(msg, false, false)` (→ DLQ).
- Started from `index.ts` via `startWelcomeConsumer()` after `connectRabbitMQ()`. On `SIGINT`/`SIGTERM`, `channel.cancel(consumerTag)` to stop new deliveries, let the in-flight `processWelcomeMessage` finish (prefetch(1) bounds it to one), then close the channel/connection alongside DB and Redis. This is best-effort cleanup, not load-bearing: if the process dies mid-handler, the message is simply requeued and the idempotent consumer dedups the redelivery — the same at-least-once path Phase 4 already covers.

**`rabbitmq.ts`** mirrors `redis.ts`'s *shape* — a module that owns the connection, asserts topology once, logs connection-state transitions, and exposes the channels plus `connectRabbitMQ()` / `disconnectRabbitMQ()` — but **not** its reconnection semantics. **`amqplib` does not auto-reconnect** (the opposite of ioredis, which owns its retry loop internally): `amqplib.connect()` *rejects* when the broker is unreachable, and after a later `'close'`/`'error'` the connection and all its channels are dead permanently. So `rabbitmq.ts` must implement reconnection itself — wrap `connect()` in try/catch and, on failure, schedule a retry (`setTimeout` backoff) rather than throwing, so a broker down at boot doesn't crash boot; then register `conn.on('close', reconnect)` / `conn.on('error', …)` handlers that re-establish the connection, re-open the (confirm) channel, re-assert the topology, and restart the consumer. This reconnect + re-assert + re-consume loop is the single most error-prone piece of amqplib boilerplate — call it out explicitly and unit-cover the down-at-boot path; do **not** treat auto-heal as a free property of "the redis.ts pattern."

## Phase 4 — Exactly once (the idempotent core)

**Dedup record — `welcomeEmail.schema.ts`:**

```ts
{ userId: string,          // Mongoose `type: String`, UNIQUE INDEX — the idempotency key + atomic lock
  email: string,
  status: 'pending' | 'sent' | 'failed',
  attempts: number,        // TRANSIENT-SEND-FAILURE counter → bounds retries (Phase 5). NOT a redelivery counter.
  sentAt?: Date,
  lastError?: string }
```

Follow the module's `*.schema.ts` shape (`new Schema({...}, { timestamps: true })`, `export type WelcomeEmailDoc = InferSchemaType<typeof schema> & { _id: Types.ObjectId }`, `export const WelcomeEmailModel = model('WelcomeEmail', schema)`). **Important — `userId` is Mongoose `type: String` with `unique: true`, *not* `Schema.Types.ObjectId`.** Unlike `task`/`post`/`like`/`comment` (whose `userId` is an ObjectId), this key is better-auth's `user.id`, which is a **string**; the unique index is on that string. `status` is `{ type: String, enum: ['pending','sent','failed'], default: 'pending' }`.

**Why two-state (`pending → sent`) and not something simpler.** Three designs were on the table:

| Design | Guarantee | Residual failure |
| --- | --- | --- |
| **X. claim-first, single-state** (insert `userId`, then send) | duplicate-free | **loss** if it crashes between claim and send |
| **Y. send-then-record** (send, then insert `userId`) | no loss | **duplicate** if it crashes between send and record; only race-safe with a single consumer |
| **Z. two-state `pending → sent`** ✅ | duplicate-free **and** no-loss, race-safe | two irreducible duplicate windows, same root cause (below) |

**Z is chosen** because it dominates on correctness for one extra status field. The atomic lock is the **unique index on `userId`** — it serializes concurrent inserts to a single winner. Note the *lock* (unique index) gives correct stored **state**; the *control flow* (branching on the returned doc, and catching the loser's `E11000` as a skip) is what turns that into no-duplicate behavior.

**The claim query — plain `{ userId }` upsert, not `{ status: {$ne:'sent'} }`.** A conditional upsert filtered on `status: { $ne: 'sent' }` *excludes* an existing `sent` doc, so the upsert falls through to an INSERT and the unique index **throws `E11000`** instead of returning the doc (verified against live MongoDB 7 + Mongoose 9.7.3). So filter on `userId` **only** — an existing doc (any status) always matches, so its `status` is returned and inspectable:

```ts
doc = WelcomeEmailModel.findOneAndUpdate(
  { userId },
  { $setOnInsert: { userId, email, status: 'pending', attempts: 0 } },  // claim = state only, NO $inc here
  { upsert: true, new: true },
)   // wrap in try/catch: a concurrent fresh-insert race can still throw E11000 → catch → { action: 'ack' } (the winner owns it)
```

`processWelcomeMessage(msg)` returns exactly one of `{ action: 'ack' }`, `{ action: 'retry' }`, or `{ action: 'dlq' }` (mapped by the consumer to `ack` / `nack(requeue)` / `nack(→DLQ)`). Per message (prefetch = 1):

1. **Malformed** (bad JSON / missing `userId` or `email`) → poison → `{ action: 'dlq' }`.
2. **Atomic claim on `userId`** (the upsert above; `E11000` from the concurrent-insert race → catch → `{ action: 'ack' }`). Then, computing the action **before any send**, branch on the returned doc:
   - `status === 'sent'` → already delivered → `{ action: 'ack' }` **(skip — no second mail).**
   - `attempts >= MAX_ATTEMPTS` → mark `failed`, set `lastError` → `{ action: 'dlq', reason: 'exhausted' }` (**cap checked before sending**).
   - otherwise (`pending` — fresh claim `attempts: 0`, or a prior attempt that crashed mid-send) → **send** via `sendWelcomeEmail(...)`:
     - success → mark `sent`, set `sentAt` → `{ action: 'ack' }`.
     - **transient** failure (SMTP timeout / connection refused / 4xx) → `$inc: { attempts: 1 }`, set `lastError`, leave `status: 'pending'` → `{ action: 'retry' }`.
     - **permanent** failure (hard SMTP 5xx / invalid recipient) → mark `failed`, set `lastError` → `{ action: 'dlq', reason: 'permanent' }`.

**`attempts` counts only real transient send failures**, not redeliveries. That's deliberate: a benign redelivery (ack lost after a successful send, or a crash after send) re-enters as `pending` but its send simply succeeds again and acks — it must not burn the retry budget, or a successfully-mailed user would eventually be DLQ'd as "exhausted." Incrementing only on a transient failure also errs safe: a crash after the failed send but before the `$inc` under-counts, granting an extra retry rather than wrongly parking a good user.

**The two irreducible duplicate windows** — both the same root cause (no atomic "send the mail AND record `sent`"):

1. **Crash after SMTP accepts, before we write `sent`.** On redelivery the doc still reads `pending`, so we resend. Sub-millisecond, in-process.
2. **SMTP accepts, but the client never learns it.** The `250 OK` is lost / the connection drops / nodemailer times out after the server already queued the mail — nodemailer reports *failure*, so we take the transient path (`nack(requeue)`, doc stays `pending`) and resend a mail that actually went out. A network-round-trip wide, still small.

Neither can be eliminated without a two-phase commit spanning the mail server and Mongo, which email does not offer — which is precisely why the honest term is **effectively once**, not exactly once. (A genuine transient failure that never reached SMTP is *not* a duplicate — its resend is correct; and an ack lost *after* we wrote `sent` reads `sent` on redelivery and is skipped — dedup-covered.) The failure (a rare duplicate welcome mail) is benign.

## Phase 5 — Ack policy, retries & the DLQ

Ack timing follows Question 3 exactly. The consumer maps `processWelcomeMessage`'s result:

| Service result | AMQP action | Effect |
| --- | --- | --- |
| `ack` (sent, or duplicate-skip) | `channel.ack(msg)` | message dropped — **only after** a confirmed send |
| `retry` (transient send failure) | `channel.nack(msg, false, true)` | requeued and redelivered; doc stays `pending` |
| `dlq` (malformed / permanent / exhausted) | `channel.nack(msg, false, false)` | dead-lettered to the DLQ, not retried |

**Topology** (asserted once by `rabbitmq.ts`, identical args on every connect — keep queue/exchange names as shared constants so publisher and consumer can't drift):

- `welcome.email` — durable main queue, declared with `arguments: { 'x-dead-letter-exchange': 'welcome.email.dlx' }`. Fed via the default exchange (publish with routing key = the queue name).
- `welcome.email.dlx` — a **fanout** exchange, bound to `welcome.email.dlq`. Fanout is deliberate: a dead-lettered message keeps its *original* routing key (`welcome.email`), so a `direct` DLX would need a matching binding key or the message is **silently dropped** into the void; fanout ignores the routing key and guarantees every poison message lands in the DLQ.
- `welcome.email.dlq` — durable — the parking lot, inspected via the management UI.

**Bounded retries (a loop guard, not a back-off).** Transient failures `nack(requeue=true)`, which the broker redelivers **immediately** — with prefetch(1) and no delay, a message that keeps failing fast (e.g. connection-refused) re-enters `processWelcomeMessage`, `$inc`s `attempts` on each real failure, and fails again as fast as round-trips allow. So the `attempts` cap (`attempts >= MAX_ATTEMPTS`, e.g. 5) is a **guard that stops an infinite loop**, not a recovery window: on a *sustained* outage the message burns through its budget quickly and dead-letters — it does not politely wait for SMTP to come back. Reusing the dedup doc as the counter avoids extra state. **Refinement (optional, out of scope):** a dedicated retry queue with a message-TTL that dead-letters back to the main queue gives *timed back-off* between attempts — the canonical RabbitMQ delayed-retry pattern. Deferred so we don't stand up three queues on day one.

**Transient vs permanent classification:** nodemailer surfaces an SMTP `responseCode`. Connection errors / timeouts / 4xx → transient (retry). A 5xx recipient rejection or a malformed message → permanent (DLQ). Against Mailpit (which accepts everything) permanent-by-SMTP is mostly academic; the malformed-message path is the realistic poison case.

---

## Message & data flow (end to end)

```
sign-up (email OR google)
   └─ better-auth creates the user row
        └─ databaseHooks.user.create.after
             └─ publishWelcomeEmail({ userId, email, name })   [persistent + confirm]
                  → RabbitMQ  welcome.email  (durable)
                       └─ consumer (prefetch 1, manual ack)
                            └─ processWelcomeMessage()   [claim: upsert {userId}, read status]
                                 ├─ status 'sent' (or E11000 race) → ack (skip, no 2nd mail)
                                 ├─ attempts >= MAX                → mark 'failed' → nack → DLQ (exhausted)
                                 ├─ pending: sendWelcomeEmail()    → Mailpit → mark 'sent' → ack
                                 ├─ transient failure              → nack(requeue)  [attempts++ only here]
                                 └─ malformed / permanent          → nack → DLQ
```

## Testing & verification (test-first; runnable proof, not claims)

- **Unit — `welcomeMail.service.test.ts`** (mocked model + mailer), the heart of the assignment:
  - first message → sends once, records `sent`, returns `ack`.
  - **duplicate** (doc already `sent`, via the read-first branch) → **no second send**, returns `ack`. ← the exactly-once assertion.
  - **concurrent-claim race** (the claim upsert throws `E11000`) → caught → returns `ack`, **no second send**.
  - `pending` doc (simulated prior crash) → resends, marks `sent`.
  - transient mail failure → returns `retry`, doc stays `pending`, no `sent` record, `attempts` incremented.
  - benign redelivery (ack lost after a successful send) → `attempts` **not** incremented (guards against DLQ'ing a mailed user).
  - `attempts >= MAX_ATTEMPTS` → returns `dlq` **before** calling the mailer (cap gates the send).
  - malformed message → returns `dlq`.
- **Hook never throws:** when `publishWelcomeEmail` rejects (broker down / confirm timeout), the `create.after` hook still resolves to `void` — unit-tested by making the publisher reject and asserting the hook resolves (a throw here would fail the sign-up request).
- **Publisher unit:** builds the correct `{ userId, email, name }` body with `persistent: true` and `await`s `waitForConfirms()` (mocked confirm channel).
- **Exactly-once proof (integration / manual, live rabbit + mailpit):** sign up once → assert **exactly one** message in Mailpit's API (`GET http://localhost:8025/api/v1/messages`). Then publish the *same* message a second time (simulated redelivery) → assert **still exactly one**. That single check demonstrates the whole assignment. A scripted version hits the Mailpit REST API and asserts `messages.length === 1` (the `messages` array is stably named across Mailpit versions — prefer it over the newer, query-scoped `messages_count`).
- **Gauntlet:** `pnpm --filter @repo/server test`, then the repo `/check` (format + turbo lint/typecheck/test).

## Env & ops notes

- `env.ts` adds `RABBITMQ_URL` (default `amqp://localhost:5672`, same optional-with-default shape as `REDIS_URL`), `SMTP_HOST` (default `localhost`), `SMTP_PORT` (default `1025`), `MAIL_FROM` (default `React_Intro <no-reply@react-intro.local>`). `.env.example` and `.env/.env.dev` get the four new keys now. (`.env/.env.prod` — referenced by the `start:prod` script but gitignored and absent by design — is not touched; prod values arrive via deploy-time env injection, per the Prod note below.)
- **Prod:** RabbitMQ and a real SMTP provider would be managed services; `RABBITMQ_URL`/SMTP creds come from deploy-time env injection, never the image. No live prod environment exists right now (EC2 gone, ECR image only), so this is a later checklist, not work now.
- **Docs to update with the code:** `apps/server/README.md` (new module + the queue diagram), `CLAUDE.md`'s stack/contract notes (RabbitMQ + Mailpit now in the dev stack), both env examples.

## Out of scope (named ceilings, not gaps to trip over later)

- **Transactional outbox** — closes the "broker down at the exact instant of sign-up loses that mail" gap. Deferred; the direct-publish-with-confirms baseline is honest about the gap and logs it.
- **Separate worker process / horizontal scale-out** of the consumer (the two-state claim is already race-safe if we do).
- **Timed back-off retry queue** (TTL + DLX-back-to-main) — the refinement over immediate requeue.
- **Client changes** — none; `apps/web` is untouched.
- **Broader mail** — verification emails, password resets, templated/HTML mail, unsubscribe. Just the one welcome mail.
