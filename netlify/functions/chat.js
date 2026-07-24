// Netlify Function — proxy an toàn tới Claude API cho chatbot "Hỏi Chú Heo AI"
// Yêu cầu: đặt biến môi trường ANTHROPIC_API_KEY trong Netlify dashboard
// (Site settings → Environment variables). API key KHÔNG được đặt trong code
// hay bất kỳ file nào commit lên Git.

const SYSTEM_PROMPT = `Bạn là "Chú Heo", trợ lý AI thân thiện của Heo Vàng (taichinhchocon.vn) — một web dạy tài chính song ngữ Việt-Anh cho trẻ 6-12 tuổi, theo khung năng lực tài chính OECD/INFE, nhân vật chính là bé Suri và ba Thanh.

Nhiệm vụ: trả lời câu hỏi của BA MẸ về cách dạy con về tiền bạc, hoặc giải thích khái niệm tài chính cơ bản một cách dễ hiểu cho trẻ em.

Quy tắc bắt buộc:
- Trả lời ngắn gọn, dưới 120 từ, giọng điệu ấm áp, thực tế, như đang trò chuyện với một phụ huynh.
- Tuyệt đối KHÔNG đưa ra lời khuyên đầu tư cụ thể (không gợi ý mua cổ phiếu, tiền số, quỹ nào) — chỉ giải thích khái niệm giáo dục chung, luôn nhắc "đây không phải lời khuyên đầu tư" nếu câu hỏi chạm tới đầu tư thật.
- Nếu câu hỏi liên quan đến nội dung có sẵn trên web (90 tập học, từ điển 50 thuật ngữ, trang Cho ba mẹ), khuyến khích ba mẹ xem thêm tại taichinhchocon.vn.
- Nếu câu hỏi không liên quan đến tài chính hoặc nuôi dạy con, lịch sự từ chối và hướng người hỏi quay lại chủ đề của web.
- Luôn trả lời bằng tiếng Việt, không dùng markdown phức tạp (không bảng, không tiêu đề).`;

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        answer: 'Chú Heo AI chưa được bật — chủ web cần thêm API key trong phần cài đặt Netlify trước nhé. Trong lúc chờ, bạn xem thử 26 tình huống thường gặp ở ngay trang này!',
        notConfigured: true
      })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Yêu cầu không hợp lệ.' }) };
  }

  const question = String(payload.question || '').trim().slice(0, 500);
  if (!question) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Vui lòng nhập câu hỏi.' }) };
  }

  // basic history support (optional) — keep it short to control cost
  const history = Array.isArray(payload.history) ? payload.history.slice(-6) : [];
  const messages = history
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 500) }));
  messages.push({ role: 'user', content: question });

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages
      })
    });

    if (!res.ok) {
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ answer: 'Chú Heo đang bận chút, ba mẹ thử lại sau ít phút nhé! 🐷' })
      };
    }

    const data = await res.json();
    const answer = (data.content && data.content[0] && data.content[0].text) || 'Chú Heo chưa nghĩ ra câu trả lời, thử hỏi lại theo cách khác xem sao nhé!';

    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answer: 'Có lỗi kết nối, ba mẹ thử lại sau ít phút nhé! 🐷' })
    };
  }
};
