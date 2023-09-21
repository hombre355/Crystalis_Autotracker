
local hal = require('hal')
if not hal.validate_environment() then
  hal.pause()
  return
end

local VERSION_MAJOR = 2
local VERSION_MINOR = 2
local VERSION_PATCH = 0
local VERSION = VERSION_MAJOR .. '.' .. VERSION_MINOR .. '.' .. VERSION_PATCH

local json = require('json')
local socket = require('socket.core')

local HOST_ADDRESS = '127.0.0.1'
local HOST_PORT = 43884
local RECONNECT_INTERVAL = 3
local KEEPALIVE_DELAY = 5

local tcp = nil
local currTime = 0
local lastTime = 0
local receiveSize = 0
local receivePart = nil

local busDomain = nil
local effectQueue = {}
local memFreezes = {}

require('statemachine')
local connectorStateMachine = StateMachine()

--	State names for connectorStateMachine
local STATE_CONNECTING = "connecting"
local STATE_CONNECTED = "connected"
local STATE_EXIT = "exit"

function applyFreezes()
  for k, fz in pairs(memFreezes) do
    local sz = fz['size']
    if checkCond(fz) then
      local wType = fz['writeType']
      local val
      local rF, wF
      if (sz == 1) and (wType > 0) then
        rF = hal.read_u8
        wF = hal.write_u8
      elseif sz == 2 then
        rF = hal.read_u16_le
        wF = hal.write_u16_le
      elseif sz == 4 then
        rF = hal.read_u32_le
        wF = hal.write_u32_le
      end
      
      if (fz['writeType'] == 0x01) then
        val = fz['value']
      elseif (fz['writeType'] == 0x02) then
        val = rF(fz['address'], fz['domain']) + fz['value']
      elseif (fz['writeType'] == 0x03) then
        val = rF(fz['address'], fz['domain']) - fz['value']
      elseif (fz['writeType'] == 0x04) then
        val = bit.bor(bit.band(fz['value'], fz['mask']), bit.band(rF(fz['address'], fz['domain']), bit.bnot(fz['mask'])))
      end
      
      wF(fz['address'], val, fz['domain'])
    end
  end
end

function checkCond(fz)
  local cond = fz['condition']
  if cond == 0x03 then --always
    return true;
  end
  
  local result
  local size = fz['cmpSize']
  
  if bit.band(cond, 0x80) == 0x80 then
    result = hal.framecount()
    cond = bit.band(cond, 0x0F)
  else
    if size == 1 then
      result = hal.read_u8(fz['cmpAddress'], fz['domain'])
    elseif cond == 2 then
      result = hal.read_u16_le(fz['cmpAddress'], fz['domain'])
    elseif cond == 4 then
      result = hal.read_u32_le(fz['cmpAddress'], fz['domain'])
    end
  end
  
  if cond == 0x01 then --equal
    return result == fz['cmpValue']
  elseif cond == 0x02 then --not equal
    return result ~= fz['cmpValue']
  elseif cond == 0x04 then --greater than
    return result > fz['cmpValue']
  elseif cond == 0x05 then --greater than or equal
    return result >= fz['cmpValue']
  elseif cond == 0x08 then --less than
    return result < fz['cmpValue']
  elseif cond == 0x09 then --less than or equal
    return result <= fz['cmpValue']
  elseif cond == 0x11 then --mask set
    return bit.band(fz['cmpValue'],result) == fz['cmpValue']
  elseif cond == 0x12 then --mask unset
    return bit.band(fz['cmpValue'],result) ~= fz['cmpValue']
  end
  return false
end

local function removeHold(addr)
  for i, v in pairs(memFreezes) do 
    if (v.address == addr) then
      memFreezes[i] = nil
    end
  end
end

function processBlock(address)
  --emu.displayMessage("block", block)
  -- local commandType = block['type']
  -- local domain = block['domain']
  -- local address = block['address']
  -- local value = block['value']
  -- local size = block['size']

  -- hal.message("command: " .. commandType)

  -- local result = {
  --   id = block['id'],
  --   stamp = os.time(),
  --   type = commandType,
  --   message = '',
  --   address = address,
  --   size = size,
  --   domain = domain,
  --   value = value
  -- }

  -- if commandType == 0x00 then --read byte dec = 0
  --   result['value'] = hal.read_u8(address, domain)
  -- elseif commandType == 0x01 then --read ushort dec = 1
  --   result['value'] = hal.read_u16_le(address, domain)
  -- elseif commandType == 0x02 then --read uint dec = 2
  --   result['value'] = hal.read_u32_le(address, domain)
  -- elseif commandType == 0x0F then --read block dec = 15
  --   hal.message("reading block")
  --   local g = hal.read_byte_range(address, value, domain)
  --   hal.message("g = " .. g)
  --   result['block'] = g
    
  -- elseif commandType == 0x10 then --write byte dec = 16
  --   hal.write_u8(address, value, domain)
  --   if memFreezes[address] ~= nil then memFreezes[address]['value'] = value end
  -- elseif commandType == 0x11 then --write ushort dec = 17
  --   hal.write_u16_le(address, value, domain)
  --   if memFreezes[address] ~= nil then memFreezes[address]['value'] = value end
  -- elseif commandType == 0x12 then --write uint dec = 18
  --   hal.write_u32_le(address, value, domain)
  --   if memFreezes[address] ~= nil then memFreezes[address]['value'] = value end
  -- elseif commandType == 0x1F then --write block dec = 31
  --   local m = hal.unpack_byte_range(block['block'], address)
  --   hal.write_byte_range(address, m, domain)
  -- elseif commandType == 0x20 then --safe bit flip (atomic) dec = 32
  --   local old = hal.read_u8(address, domain)
  --   hal.write_u8(address, bit.bor(old, value), domain)
  --   block['value'] = old
  -- elseif commandType == 0x21 then --safe bit unflip (atomic) dec = 33
  --   local old = hal.read_u8(block['address'])
  --   hal.write_u8(address, bit.band(old, bit.bnot(value)), domain)
  --   block['value'] = old
  -- elseif commandType == 0x30 then --memory freeze unsigned dec = 48
  --   table.insert(memFreezes, {
  --     address = address,
  --     domain = domain,
  --     value = value,
  --     size = size,
  --     mask = 0xFF,
  --     writeType = block['writeType'],
  --     cmpAddress = block['cmpAddress'],
  --     cmpValue = block['cmpValue'],
  --     cmpSize = block['cmpSize'],
  --     condition = block['condition']
  --   })
  -- elseif commandType == 0x3F then --memory unfreeze dec = 63
  --   removeHold(address)
  -- elseif commandType == 0xE0 then --load rom dec = 224
  --   hal.open_rom(block['message'])
  -- elseif commandType == 0xE1 then --unload rom dec = 225
  --   hal.close_rom()
  -- elseif commandType == 0xE2 then --get rom path dec = 226
  --   result['message'] = hal.get_rom_path()
  -- elseif commandType == 0xE3 then --get emulator core id dec = 227
  --   hal.message("getting emulator core id")
  -- 	local a = ((value >> 16) & 0xFF)
  -- 	local b = ((value >>  8) & 0xFF)
  -- 	local c = (value & 0xFF)

  --   local major = VERSION_MAJOR << 16
  --   local minor = VERSION_MINOR << 8
  --   result['value'] = major | (minor | VERSION_PATCH)
  --   result['message'] = hal.get_system_id()
  -- elseif commandType == 0xF0 then -- dec = 240
  --   hal.message(block['message'])
  -- elseif commandType == 0xFF then -- dec = 255
  --   -- do nothing
  -- else
  --   hal.message("inside else: ")
  --   return
  -- end
  test = emu.read(address, emu.memType.nesDebug)

  sendBlock(test)
end

function sendBlock(block)
  local data = json.encode(block)
  local size = data:len()

  local a = string.char((size >> 24) & 0xFF)
  local b = string.char((size >> 16) & 0xFF)
  local c = string.char((size >> 8) & 0xFF)
  local d = string.char(size & 0xFF)

  --hal.message("test = ".. string.byte(d))
  --hal.message("sent data: " .. data)
  --hal.message("data size: " .. size)

  local ret, err = tcp:send(data)
  if ret == nil then
    hal.message("Failed to send: " .. err)
  end
end

function receiveData(n)
  local data, err, part = tcp:receive(n, receivePart)
  if data == nil then
    if err ~= 'timeout' then
      hal.message("connection losttttt:" .. err)
      reconnect()
    else
      --hal.message("is " .. err)
      receivePart = part
      local a = tonumber(receivePart)
      if a ~= nil then
        hal.message("part: " .. a)
      end
    end
  else
    hal.message("r data: " .. string.format("%#x", data))
    receivePart = nil
  end
  return data
end

function receive()
  currTime = os.time()
  test = 0
  -- the first byte tells us what to do
  while true do
    if receiveSize == 0 then
      local n = receiveData(1)
      --hal.message("n: " .. n)
      if n == nil then
        hal.message("n is nil")
         break
      end
      test = 1
    end

    -- use the size to get the rest of the message
    -- 1 is read byte from address
    if test == 1 then
      local data = receiveData(5)
      if data == nil then
        hal.message("data is nil")
        break
      end

      processBlock(json.decode(data))
      receiveSize = 0
    end

    lastTime = currTime
  end

  if lastTime + KEEPALIVE_DELAY < currTime then
    hal.message("Keepalive failed")
    reconnect()
  end
end

function reconnect()
	if connectorStateMachine:get_current_state_name() ~= STATE_EXIT then
    hal.message("reconnecting is not cool")
		connectorStateMachine:set_current_state(STATE_CONNECTING)
	end
end

function disconnect()
	if tcp then
		tcp:shutdown()
		tcp:close()
		tcp = nil
	end
  hal.message('Destroying connection...')
end

--	Connector State Machine Implementation

local function onEnter_Connecting()
	hal.draw_begin()
	local y = hal.draw_get_framebuffer_height() / 2
	hal.draw_text(2, y, 'Connecting to ConnectorLib host...', 'red', 'black')
  hal.message('Connecting to ConnectorLib host...')
	hal.draw_end()

	hal.pause()
end

local function onExit_Connecting()
	hal.draw_clear()
	hal.unpause()	
end

local function onTick_Connecting()
    currTime = os.time()
    if lastTime + RECONNECT_INTERVAL <= currTime then
		lastTime = currTime
		tcp = socket.tcp()

		local ret, err = tcp:connect(HOST_ADDRESS, HOST_PORT)
		if ret == 1 then
			hal.message('Connection established asdf')
			tcp:settimeout(0)
      tcp:send("Connected")
			connectorStateMachine:set_current_state(STATE_CONNECTED)
		else
			--print('Failed to open socket:', err)
      --emu.displayMessage("Failed to open socket:", err)
      hal.message("Failed to open socket:" .. err)
			tcp:close()
			tcp = nil
		end
    end
end

local function onTick_Connected()
    receive()
    applyFreezes()
end

local function onExit_Connected()
  hal.message('onExit...')
	disconnect()
end

local function onEnter_Exit()
  hal.message('onEnter...')
	disconnect()
end

local function tick()
	connectorStateMachine:tick()
end

local function shutdown()
	connectorStateMachine:set_current_state(STATE_EXIT)
end

connectorStateMachine:register_state(STATE_CONNECTING, onTick_Connecting, onEnter_Connecting, onExit_Connecting)
connectorStateMachine:register_state(STATE_CONNECTED, onTick_Connected, nil, onExit_Connected)
connectorStateMachine:register_state(STATE_EXIT, nil, onEnter_Exit, nil)

local function startup()
	connectorStateMachine:set_current_state(STATE_CONNECTING)	
end

--print('ConnectorLib Lua Connector ' .. VERSION .. ' (' .. socket._VERSION .. ')')
local msg = 'ConnectorLib Lua Connector ' .. VERSION .. ' (' .. socket._VERSION .. ')'
--emu.drawString(0, 0, msg, red, black)
--emu.displayMessage("test", msg)
hal.message(msg)

--	Configure and startup the HAL	
hal.register_startup("connector_startup", startup)
hal.register_tick("connector_tick", tick)
hal.register_shutdown("connector_shutdown", shutdown)
hal.startup()
