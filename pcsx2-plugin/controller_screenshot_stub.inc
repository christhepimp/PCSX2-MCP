		// ----- SEND CONTROLLER (stub — wire to PAD/USB host input) -----
		else if (cmd == "send_controller")
		{
			int port = (int)getNum(params, "port", 0);
			int slot = (int)getNum(params, "slot", 0);
			int buttons = (int)getNum(params, "buttons", 0);
			int lx = (int)getNum(params, "lx", 128);
			int ly = (int)getNum(params, "ly", 128);
			int rx = (int)getNum(params, "rx", 128);
			int ry = (int)getNum(params, "ry", 128);

			j.startObject();
			j.kv("ok", false);
			j.kv("error", "send_controller stub: C++ pad injection not hooked yet");
			j.kv("port", (int64_t)port);
			j.kv("slot", (int64_t)slot);
			j.kv("buttons", (int64_t)buttons);
			j.kv("lx", (int64_t)lx);
			j.kv("ly", (int64_t)ly);
			j.kv("rx", (int64_t)rx);
			j.kv("ry", (int64_t)ry);
			j.kv("message", "Implement by writing into virtual pad state used by Pad::Update / SIO");
			j.endObject();
		}
		// ----- GET SCREENSHOT (stub — wire to GS present / host capture) -----
		else if (cmd == "get_screenshot")
		{
			int max_width = (int)getNum(params, "max_width", 640);
			std::string format = getStr(params, "format", "png");

			j.startObject();
			j.kv("ok", false);
			j.kv("error", "get_screenshot stub: GS framebuffer hook not implemented yet");
			j.kv("max_width", (int64_t)max_width);
			j.kv("format", format);
			j.kv("note", "Hook GSRenderer present path or capture host window; return base64 PNG in data field");
			j.endObject();
		}
