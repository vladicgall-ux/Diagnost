export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    hasKey: Boolean(process.env.GROQ_API_KEY) && process.env.GROQ_API_KEY !== "your_key_here",
  });
}
