-- Crystalis Autotracker bridge for Mesen 2 (Lua 5.4).
-- Streams game RAM to the tracker app as newline-delimited JSON over TCP.
-- Requires Mesen settings: AllowNetworkAccess=true, AllowIoOsAccess=true.
-- The tracker app rewrites HOST/PORT below when it materializes this script.

local HOST = "127.0.0.1"
local PORT = 32275
local PROTO = 1
local SCRIPT_VERSION = "bridge.lua/0.1.0"
local POLL_FRAMES = 10 -- ~6 Hz at 60fps
local RECONNECT_SECONDS = 3

local core = nil
local okSocket, socketCore = pcall(require, "socket.core")
if okSocket then core = socketCore end

-- Regions streamed to the app (CPU-bus addresses). Keep in sync with
-- app/src/shared/ram/addresses.ts.
local REGIONS = {
  { key = "6430", start = 0x6430, len = 0x30 }, -- inventory slots + spells
  { key = "6480", start = 0x6480, len = 0x60 }, -- event bits, boss/chest bits, key items row 2, door bits
  { key = "1bc0", start = 0x1BC0, len = 2 },    -- max/cur HP
  { key = "1f02", start = 0x1F02, len = 8 },    -- gold, exp, exp-to-next, MP
}
local SEED_START, SEED_LEN = 0xB885, 8
local FLAG_START, FLAG_LEN = 0xB7F0, 0xA0
local GAME_STATE_ADDR = 0x0040

-- ---------- tiny base64 encoder ----------
local B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local function b64encode(bytes)
  local out = {}
  local n = #bytes
  local i = 1
  while i + 2 <= n do
    local a, b, c = bytes[i], bytes[i + 1], bytes[i + 2]
    local word = a * 65536 + b * 256 + c
    out[#out + 1] = B64:sub(math.floor(word / 262144) + 1, math.floor(word / 262144) + 1)
    out[#out + 1] = B64:sub(math.floor(word / 4096) % 64 + 1, math.floor(word / 4096) % 64 + 1)
    out[#out + 1] = B64:sub(math.floor(word / 64) % 64 + 1, math.floor(word / 64) % 64 + 1)
    out[#out + 1] = B64:sub(word % 64 + 1, word % 64 + 1)
    i = i + 3
  end
  local rem = n - i + 1
  if rem == 2 then
    local a, b = bytes[i], bytes[i + 1]
    local word = a * 65536 + b * 256
    out[#out + 1] = B64:sub(math.floor(word / 262144) + 1, math.floor(word / 262144) + 1)
    out[#out + 1] = B64:sub(math.floor(word / 4096) % 64 + 1, math.floor(word / 4096) % 64 + 1)
    out[#out + 1] = B64:sub(math.floor(word / 64) % 64 + 1, math.floor(word / 64) % 64 + 1)
    out[#out + 1] = "="
  elseif rem == 1 then
    local a = bytes[i]
    local word = a * 65536
    out[#out + 1] = B64:sub(math.floor(word / 262144) + 1, math.floor(word / 262144) + 1)
    out[#out + 1] = B64:sub(math.floor(word / 4096) % 64 + 1, math.floor(word / 4096) % 64 + 1)
    out[#out + 1] = "=="
  end
  return table.concat(out)
end

-- ---------- minimal JSON string escaping (only used for the flag string) ----------
local function jsonEscape(s)
  return (s:gsub('[%c"\\]', function(ch)
    if ch == '"' then return '\\"' end
    if ch == "\\" then return "\\\\" end
    return string.format("\\u%04x", ch:byte())
  end))
end

-- ---------- memory helpers ----------
local function readRegion(start, len)
  local bytes = {}
  for i = 0, len - 1 do
    bytes[i + 1] = emu.read(start + i, emu.memType.nesDebug)
  end
  return bytes
end

local function bytesEqual(a, b)
  if a == nil or b == nil or #a ~= #b then return false end
  for i = 1, #a do
    if a[i] ~= b[i] then return false end
  end
  return true
end

local function bytesToHex(bytes)
  local out = {}
  for i = 1, #bytes do out[#out + 1] = string.format("%02x", bytes[i]) end
  return table.concat(out)
end

-- ---------- connection state ----------
local sock = nil
local lastAttempt = 0
local seq = 0
local cache = {}       -- key -> last-sent bytes
local lastSeed = nil
local lastFlags = nil
local lastGameState = nil
local frameCount = 0

local function disconnect()
  if sock then pcall(function() sock:close() end) end
  sock = nil
  cache = {}
  lastSeed = nil
  lastFlags = nil
  lastGameState = nil
end

local function sendLine(line)
  if not sock then return false end
  local data = line .. "\n"
  -- luasocket send reports errors via return values: (sent) or (nil, err, lastByte).
  -- On "timeout" (buffer full) resume from the last byte actually sent to keep framing intact.
  local i = 1
  local attempts = 0
  while i <= #data do
    local ok, sent, err, last = pcall(sock.send, sock, data, i)
    if not ok then
      disconnect()
      return false
    end
    if sent then return true end
    if err == "timeout" then
      i = (last or i - 1) + 1
      attempts = attempts + 1
      if attempts > 100 then
        -- Can't finish the line without blocking; a partial line would corrupt
        -- framing, so drop the connection and let reconnect resync cleanly.
        disconnect()
        return false
      end
    else
      disconnect()
      return false
    end
  end
  return true
end

local function tryConnect()
  if not core then return end
  local now = os.time()
  if now - lastAttempt < RECONNECT_SECONDS then return end
  lastAttempt = now
  local t = core.tcp()
  t:settimeout(1)
  local ok, err = t:connect(HOST, PORT)
  if not ok then
    pcall(function() t:close() end)
    return
  end
  t:settimeout(0) -- non-blocking from here on
  sock = t
  cache = {}
  lastSeed = nil
  lastFlags = nil
  lastGameState = nil
  sendLine(string.format(
    '{"t":"hello","proto":%d,"emu":"mesen2","script":"%s"}', PROTO, SCRIPT_VERSION))
  emu.displayMessage("Autotracker", "Connected to tracker app")
end

local function handleAppLine(line)
  -- Fixed grammar; avoid a full JSON parser. Recognize by message type substring.
  if line:find('"resync"') then
    cache = {}
    lastSeed = nil
    lastFlags = nil
    lastGameState = nil
  elseif line:find('"ping"') then
    local s = line:match('"seq"%s*:%s*(%d+)') or "0"
    sendLine(string.format('{"t":"pong","seq":%s}', s))
  end
end

local function pollAppMessages()
  if not sock then return end
  while true do
    local line, err = sock:receive("*l")
    if line then
      handleAppLine(line)
    else
      if err == "closed" then disconnect() end
      return
    end
  end
end

-- ---------- per-poll work ----------
local function poll()
  if not sock then
    tryConnect()
    if not sock then return end
  end

  pollAppMessages()
  if not sock then return end

  -- game state
  local state = emu.read(GAME_STATE_ADDR, emu.memType.nesDebug)
  if state ~= lastGameState then
    lastGameState = state
    if not sendLine(string.format('{"t":"gamestate","v":%d}', state)) then return end
  end

  -- seed checksum (ROM-stamped; changes on ROM load)
  local seedBytes = readRegion(SEED_START, SEED_LEN)
  local seedHex = bytesToHex(seedBytes)
  if seedHex ~= lastSeed then
    lastSeed = seedHex
    cache = {} -- new seed: force a full region resend
    if not sendLine(string.format('{"t":"seed","checksum":"%s"}', seedHex)) then return end
  end

  -- flag string (menu ROM bank; only trustworthy while in menu)
  if state == 3 then
    local raw = {}
    for i = 0, FLAG_LEN - 1 do
      local byte = emu.read(FLAG_START + i, emu.memType.nesDebug)
      if byte >= 0x20 and byte < 0x7F then
        raw[#raw + 1] = string.char(byte)
      end
    end
    local flagStr = table.concat(raw)
    if flagStr ~= lastFlags and #flagStr > 0 then
      lastFlags = flagStr
      if not sendLine(string.format('{"t":"flags","raw":"%s"}', jsonEscape(flagStr))) then return end
    end
  end

  -- changed RAM regions
  local parts = {}
  for _, region in ipairs(REGIONS) do
    local bytes = readRegion(region.start, region.len)
    if not bytesEqual(bytes, cache[region.key]) then
      cache[region.key] = bytes
      parts[#parts + 1] = string.format('"%s":"%s"', region.key, b64encode(bytes))
    end
  end
  if #parts > 0 then
    seq = seq + 1
    sendLine(string.format('{"t":"ram","seq":%d,"regions":{%s}}', seq, table.concat(parts, ",")))
  end
end

-- ---------- wire up ----------
if not core then
  emu.displayMessage("Autotracker", "socket.core unavailable - enable 'Allow network access' in Mesen script settings")
  emu.log("Autotracker bridge: require('socket.core') failed. Enable Debug > Script Window > Allow network access.")
else
  emu.addEventCallback(function()
    frameCount = frameCount + 1
    if frameCount % POLL_FRAMES == 0 then
      local ok, err = pcall(poll)
      if not ok then emu.log("Autotracker bridge error: " .. tostring(err)) end
    end
  end, emu.eventType.endFrame)
  emu.log("Autotracker bridge started; connecting to " .. HOST .. ":" .. PORT)
end
