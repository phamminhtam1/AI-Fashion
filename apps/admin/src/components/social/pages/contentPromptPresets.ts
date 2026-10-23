/** Prompt chuyên biệt cho từng lựa chọn trong form tạo content bằng AI. */
export const GOAL_PROMPTS: Record<string, string> = {
  "Giới thiệu sản phẩm": "Tập trung giới thiệu sản phẩm rõ ràng: nêu điểm khác biệt, chất liệu, phom dáng, lợi ích sử dụng và hoàn cảnh phù hợp. Kết thúc bằng lời mời khám phá sản phẩm tự nhiên, không quảng cáo quá mức.",
  "Khuyến mãi": "Viết theo hướng thúc đẩy chuyển đổi: làm nổi bật ưu đãi và lợi ích mua ngay, tạo cảm giác cấp thiết vừa phải, CTA rõ ràng. Không tự bịa mức giảm, thời hạn hoặc điều kiện khuyến mãi nếu brief không cung cấp.",
  "Bộ sưu tập": "Giới thiệu bộ sưu tập như một câu chuyện thời trang thống nhất: làm rõ cảm hứng, bảng màu, tinh thần thiết kế và cách các sản phẩm phối hợp với nhau. Ưu tiên cảm xúc thương hiệu hơn mô tả bán hàng đơn lẻ.",
  "Kiến thức thời trang": "Tạo nội dung có giá trị hướng dẫn: cung cấp mẹo phối đồ, lựa chọn phom dáng, chất liệu hoặc cách sử dụng sản phẩm. Thông tin phải thực tế, dễ áp dụng và gắn sản phẩm vào ngữ cảnh một cách tự nhiên.",
  "Tăng tương tác": "Ưu tiên khơi gợi hội thoại: mở đầu bằng insight gần gũi, đặt một câu hỏi cụ thể hoặc lời mời chia sẻ lựa chọn ở cuối bài. Nội dung phải dễ phản hồi, tránh câu hỏi chung chung hoặc câu kéo tương tác máy móc.",
  "Khác": "Bám sát mục tiêu đặc thù được mô tả trong phần thông tin bổ sung. Tự xác định cấu trúc và CTA phù hợp nhưng không suy diễn dữ kiện chưa được cung cấp.",
};

export const STYLE_PROMPTS: Record<string, string> = {
  "Thanh lịch, hiện đại": "Dùng ngôn ngữ tinh gọn, có nhịp điệu, hình ảnh đương đại và cảm giác chỉn chu. Nhấn mạnh sự thanh lịch ứng dụng; tránh sáo ngữ, khoa trương và quá nhiều biểu tượng cảm xúc.",
  "Trẻ trung, năng động": "Dùng câu ngắn, nhịp nhanh, từ ngữ tươi mới và giàu năng lượng. Có thể dùng emoji có chọn lọc, nhưng vẫn giữ chất thời trang và không dùng tiếng lóng khó hiểu.",
  "Sang trọng, tối giản": "Viết tối giản, giàu khoảng thở và có sắc thái cao cấp. Chọn từ chính xác, tiết chế tính từ, làm nổi bật chất liệu và đường nét; không dùng giọng bán hàng ồn ào.",
};

export const TONE_PROMPTS: Record<string, string> = {
  "Thân thiện, truyền cảm hứng": "Trò chuyện ấm áp và gần gũi như một stylist đáng tin cậy. Khuyến khích người đọc tự tin thể hiện phong cách, không lên lớp và không tạo áp lực mua hàng.",
  "Chuyên nghiệp, tin cậy": "Trình bày mạch lạc, chắc chắn và có căn cứ từ dữ liệu sản phẩm. Hạn chế cảm thán; không phóng đại công dụng, chất liệu, độ bền hoặc cam kết chưa được xác minh.",
  "Vui tươi, gần gũi": "Giữ giọng vui vẻ, tự nhiên và có duyên; có thể dùng câu hỏi, emoji và cách diễn đạt đời thường vừa đủ. Tránh lố, trẻ con hóa hoặc làm giảm cảm nhận cao cấp của thương hiệu.",
};

export const AUDIENCE_PROMPTS: Record<string, string> = {
  "Nữ công sở": "Viết cho phụ nữ đi làm quan tâm sự chỉn chu, thoải mái và linh hoạt từ văn phòng đến gặp gỡ sau giờ làm. Ưu tiên tình huống sử dụng thực tế và cách phối dễ áp dụng.",
  "18-25": "Viết cho nhóm 18–25 tuổi yêu thích xu hướng, thể hiện cá tính và nội dung nhanh, trực quan. Giữ mức giá trị thực tế, nhịp trẻ nhưng không cố dùng tiếng lóng.",
  "25-35": "Viết cho nhóm 25–35 tuổi ưu tiên thiết kế có gu, chất lượng và tính ứng dụng. Cân bằng cảm hứng phong cách với thông tin sản phẩm hữu ích.",
  "35-45": "Viết cho nhóm 35–45 tuổi coi trọng sự tinh tế, vừa vặn, chất liệu và khả năng sử dụng lâu dài. Giọng văn trưởng thành, rõ ràng và tôn trọng.",
  "Khác": "Không giả định tuổi, nghề nghiệp hoặc lối sống. Dùng ngôn ngữ bao quát và bám sát chân dung khách hàng được cung cấp trong thông tin bổ sung.",
};

const resolvePrompt = (map: Record<string, string>, value: string, label: string) =>
  map[value] || `${label}: ${value}. Hãy thể hiện lựa chọn này nhất quán trong toàn bộ nội dung.`;

export function buildSelectionPrompts(input: { goal: string; style: string; tone: string; audience: string }) {
  return {
    goal: resolvePrompt(GOAL_PROMPTS, input.goal, "Mục tiêu content"),
    style: resolvePrompt(STYLE_PROMPTS, input.style, "Phong cách nội dung"),
    tone: resolvePrompt(TONE_PROMPTS, input.tone, "Tông giọng"),
    audience: resolvePrompt(AUDIENCE_PROMPTS, input.audience, "Đối tượng khách hàng"),
  };
}
