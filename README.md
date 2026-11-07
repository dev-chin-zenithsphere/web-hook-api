# Checkweigher TCP Gateway (Node.js + Express)

เกตเวย์ TCP-to-REST/Webhook แบบ mock-first สำหรับผลชั่งรายชิ้น แยก TCP transport, protocol adapter, normalized result และ webhook sender ออกจากกัน

> รองรับเฉพาะ **mock / `simulator-line-v1`** ซึ่งเป็นโปรโตคอลของโปรเจกต์นี้ ไม่ใช่ Anritsu และไม่อ้างว่าใช้กับ KWS6206BP06 ได้ Real mode ถูกปฏิเสธเสมอจนกว่าจะมี adapter ที่สร้างจากเอกสารยืนยันของ Anritsu

## ติดตั้งและรันบน Windows

ต้องมี Node.js 20 ขึ้นไป

```powershell
npm install
Copy-Item .env.example .env
npm start
```

ค่าตั้งต้น HTTP คือ `127.0.0.1:3000`; TCP mock server คือ `127.0.0.1:4010`. เปิด PowerShell อีกหน้าต่าง:

```powershell
node src/simulator.js
```

Simulator ส่งข้อความที่แบ่งหลาย chunks, หลายข้อความต่อ chunk และข้อความผิดรูปแบบ โดยไม่ต่อเครื่องจริงหรือส่ง Webhook ภายนอก

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
Invoke-RestMethod http://127.0.0.1:3000/ready
Invoke-RestMethod http://127.0.0.1:3000/api/status
Invoke-RestMethod http://127.0.0.1:3000/api/results/latest
Invoke-RestMethod 'http://127.0.0.1:3000/api/results?offset=0&limit=20'
npm test
```

ใช้ `npm run dev` สำหรับ Node watch mode. ประวัติและ Webhook queue เป็น memory จึงหายเมื่อ restart.

## การตั้งค่า

`config.json` พร้อมรัน mock และ `config.example.json` มีค่าเดียวกัน. ค่า mock TCP เป็นของ simulator ไม่ใช่เครื่องชั่ง.

| ค่า | ความหมาย |
|---|---|
| `http.host`, `http.port` | HTTP listener; default เป็น localhost |
| `mode` | `mock` หรือ `real` (real ถูกปฏิเสธถ้ายังไม่มี verified adapter) |
| `tcp.role` | `server` รับ connection หรือ `client` ต่อออก |
| `tcp.host`, `tcp.port` | TCP endpoint/interface |
| `connectTimeoutMs` | เวลาอนุญาตเฉพาะขณะ TCP client กำลังเชื่อมต่อ |
| `idleTimeoutMs` | timeout เมื่อการเชื่อมต่อเงียบ; ค่า `null` คือไม่ตัด connection เพราะไม่มีผลชั่งเข้ามา |
| `reconnectDelayMs`, `maxReconnectDelayMs` | initial/cap ของ exponential reconnect backoff (ไม่สร้าง connection ซ้ำ) |
| `adapter` | ปัจจุบันมีเพียง `simulator-line-v1` |
| `framing`, `encoding` | delimiter, receive-buffer limit และ encoding ของ adapter |
| `serverConnectionPolicy` | `single-reject` รับทีละ client แล้วปฏิเสธรายถัดไป |
| `captureRaw` | log raw TCP chunk เป็น `hex`/`base64`; `maxCaptureBytes` จำกัดส่วนที่ encode/log ต่อ chunk |
| `webhook.*` | เปิด POST, URL, timeout, retry, delay และ max queue |
| `storage.maxResults` | ผลสูงสุดใน memory |
| `log.path`, `log.maxBytes` | ตำแหน่งและเพดานไฟล์ log ก่อนหมุน `.1` |
| `shutdown.webhookDrainTimeoutMs` | เวลาสูงสุดที่รอ Webhook queue เมื่อ process ถูกสั่งหยุด |

`config.real.template.json` จงใจใส่ค่าที่ไม่ทราบเป็น `null`; ห้ามใส่ port/grammar ที่เดาเอง Startup validation จะแจ้งข้อผิดพลาดชัดเจน. API key และ webhook secret ต้องใส่ใน `.env`: `API_KEY` จำเป็นเมื่อ HTTP เปิดนอก localhost และส่งผ่าน `X-API-Key`; `WEBHOOK_SECRET` ใช้ HMAC `X-Webhook-Signature`. Secret ไม่อยู่ใน config หรือ log.

## รูปแบบ mock และข้อมูลที่แปลงแล้ว

Simulator-only grammar ต่อหนึ่งบรรทัด UTF-8:

```text
WEIGHT=123.45;UNIT=g;RESULT=OK\n
```

เมื่อ valid จะสร้าง `eventId`, `weight` (finite), `unit`, `result` (`OK`/`NG`) และ `receivedAt` (PC ISO 8601). หากไม่มี/parse `RESULT` ไม่ได้ จะเป็น unparsed event และไม่ส่ง webhook; ไม่มีการตั้ง OK default หรือคำนวณ OK/NG เอง. Raw bytes ถูก log ก่อน decode และ decode เฉพาะ encoding ที่ adapter ระบุ. Raw capture ถูก truncate ตาม `maxCaptureBytes` ก่อน encode เพื่อจำกัด log. Buffer เกิน limit จะถูก drop พร้อม log/counter `tcp.overflow`.

## Webhook และ LAN

ผลชั่งสมบูรณ์จะ POST แบบ background ไม่บล็อก TCP. Retry ทุกครั้งใช้ `eventId` เดิมทั้ง body และ `X-Event-Id` เพื่อให้ปลายทาง deduplicate. หาก queue เต็ม ระบบ log error และเพิ่ม `webhookDropped` counter ไม่ทิ้งเงียบ ๆ. ระบบไม่รับประกัน exactly-once delivery. ค่า default ปิด webhook จึงไม่ติดต่อบริการจริงเอง.

หากจะเปิด LAN ให้ตั้ง `http.host` เป็น interface ที่ต้องการ (เช่น `0.0.0.0`), ตั้ง `API_KEY`, และจำกัด firewall/network. TCP port ควรถูกจำกัดเครือข่ายเช่นกัน.

## Swagger / OpenAPI

เมื่อ gateway ทำงาน เปิด Swagger UI ที่ http://127.0.0.1:3000/docs และ OpenAPI JSON ที่ http://127.0.0.1:3000/openapi.json. เอกสารทั้งสองเป็น public และไม่มีข้อมูลผลชั่งหรือ secret; กด Authorize ใน Swagger UI แล้ววาง API key ก่อนเรียก API ธุรกิจที่ป้องกันไว้.

สำหรับ monitoring ใช้ `GET /health` เพื่อตรวจว่า process ยังทำงาน และ `GET /ready` เพื่อตรวจว่า TCP server กำลัง listen หรือ TCP client เชื่อมต่อสำเร็จแล้ว; `/ready` ส่ง HTTP 503 จนกว่า TCP จะพร้อม ทั้งสอง endpoint เป็น public เพื่อให้ load balancer/monitor เรียกได้ แม้เปิด API key สำหรับ API ธุรกิจแล้ว.

REST API ที่ Swagger อธิบายคือ `GET /api/status`, `GET /api/results/latest` และ `GET /api/results?offset=0&limit=50`. API ธุรกิจเหล่านี้ต้องใช้ `X-API-Key` หากตั้งค่า `API_KEY` แล้ว.

## PM2 สำหรับ Windows

หลัง npm install ให้ใช้ PM2 ที่อยู่ใน dependency ของโปรเจกต์:

```powershell
npm run pm2:start
npm run pm2:status
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
npm run pm2:delete
```

ecosystem.config.cjs บังคับ instance เดียว (TCP listener ใช้ port เดียว), restart เมื่อ process ล่ม, ปิด watch mode, restart เมื่อเกิน 300 MB และรอสูงสุด 7 วินาทีให้ application drain Webhook ก่อน kill. PM2 output/error อยู่ที่ logs/pm2-out.log และ logs/pm2-error.log; application JSON log อยู่ที่ log.path ใน config. ใช้ npm run pm2:flush เพื่อล้าง PM2 log หรือ npm run pm2:monit เพื่อดูแบบ interactive.

ตั้ง PM2 log rotation ครั้งเดียว (คำสั่งจะติดตั้ง PM2 module ลง PM2 home ของผู้ใช้):

```powershell
npm run pm2:logrotate
```

คำสั่งตั้งหมุนที่ 10 MB, เก็บ 14 ชุด และบีบอัดไฟล์เก่า. PM2 ดูแล crash restart เท่านั้น; การเริ่มอัตโนมัติหลัง Windows reboot ต้องตั้ง Windows Task Scheduler/บริการตามนโยบาย IT และไม่ควรตั้งก่อนกำหนด account/service policy.

## ก่อนเชื่อม Anritsu จริง

ขอ Ethernet Text Specifications ของ KWS6206BP06 และยืนยัน: TCP port/IP และ client/server role, framing, encoding, handshake/keepalive, grammar ของ weight/unit/OK-NG, raw-byte samples ที่มีผลตัดสิน, คำสั่งที่จำเป็น (ถ้ามี) และ reconnect/concurrency behavior. แล้วจึงเขียน adapter ตามเอกสารและทดสอบกับ captured samples. Gateway JSON คือข้อมูลแปลงแล้ว ไม่ใช่รูปแบบ raw ที่ยืนยันจาก Anritsu และระบบไม่ส่ง control command/handshake ที่เดาขึ้นเอง.

## การทดสอบ

รัน `npm test` เพื่อทดสอบบน localhost เท่านั้น ปัจจุบันมี 9 test groups ครอบคลุม fragmented/coalesced messages, malformed/no-result, buffer overflow, client disconnect/reconnect, idle connection, Webhook timeout/retry/queue full, raw-capture truncation, Swagger/API key, REST API/latest/history, simulator grammar และ config validation.
