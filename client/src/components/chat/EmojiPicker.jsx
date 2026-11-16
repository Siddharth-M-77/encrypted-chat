const EMOJIS = ('😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😋 😛 😜 🤪 😎 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😴 🤤 😷 🤒 🤕 🤢 🤮 🥴 😈 👻 💀 🤖 🎃 ' +
  '👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👏 🙌 🙏 💪 👀 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 ✨ 🔥 💯 🎉 🎁 ⭐ 🌈 ☀️ 🌙 ⚡ 💎 🚀 🏆 ☕ 🍕 🍔 🍺 🎵 📷 💬 ✅ ❌ ⚠️').split(' ');

export default function EmojiPicker({ onPick }) {
  return (
    <div className="glass-strong absolute bottom-full left-0 z-20 mb-3 grid max-h-60 w-72 animate-scale-in grid-cols-8 gap-0.5 overflow-y-auto rounded-3xl p-2.5">
      {EMOJIS.map((e) => (
        <button key={e} type="button" className="rounded-xl p-1 text-xl transition hover:scale-125 hover:bg-white/10" onClick={() => onPick(e)}>{e}</button>
      ))}
    </div>
  );
}
