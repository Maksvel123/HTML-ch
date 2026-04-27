import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Инициализация Google Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const RULES = {
  maxLinkLength: 120, 
  maxImageSizeKB: 250, 
  aiGuidelines: [
    "Найди устаревшие теги (например <font>, <center>, <marquee>).",
    "Проверь соотношение текста к картинкам. Если текста мало (меньше 300 символов), а картинок много - это строгий спам-триггер.",
    "Найди использование CSS grid или flexbox. Они плохо поддерживаются в email-клиентах, верстка должна быть табличной.",
    "Оцени общую семантику и чистоту кода. Нет ли пустых тегов?"
  ]
};

async function getImageSize(url) {
  try {
    if (!url.startsWith('http')) return 0;
    const response = await axios.head(url, { timeout: 3000 });
    const bytes = response.headers['content-length'];
    return bytes ? Math.round(bytes / 1024) : 0; 
  } catch (e) {
    return 0; 
  }
}

// Оптимизация HTML перед отправкой в AI
function minifyHtmlForAI(html) {
  return html
    .replace(/src="data:image\/[^;]+;base64,[^"]+"/g, 'src="[BASE64_IMAGE_REMOVED]"')
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/g, '<svg>[SVG_REMOVED]</svg>')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(req) {
  try {
    const { html } = await req.json();
    if (!html) return NextResponse.json({ error: 'HTML не предоставлен' }, { status: 400 });

    const $ = cheerio.load(html);
    const errors = [];
    
    // 1. СБОР СТАТИСТИКИ
    const textContent = $('body').text().replace(/\s+/g, ' ').trim();
    const textLength = textContent.length;
    const imagesCount = $('img').length;
    let totalImagesWeight = 0;

    // 2. ХАРД-ПРАВИЛА (Node.js)
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      if (href.length > RULES.maxLinkLength) {
        errors.push({
          severity: 'Medium',
          title: 'Слишком длинная ссылка',
          details: `Ссылка превышает лимит в ${RULES.maxLinkLength} символов. Почтовики могут посчитать это фишингом.`,
          fix: 'Используйте сервис сокращения ссылок.'
        });
      }
    });

    const imagePromises = $('img').map(async (i, el) => {
      const src = $(el).attr('src') || '';
      const alt = $(el).attr('alt');
      
      if (!alt) {
        errors.push({
          severity: 'Low',
          title: 'Отсутствует атрибут alt',
          details: `У картинки [${src.substring(0,40)}...] нет alt-текста.`,
          fix: 'Добавьте атрибут alt="описание" ко всем тегам <img>.'
        });
      }

      if (src) {
        const sizeKB = await getImageSize(src);
        totalImagesWeight += sizeKB;
        if (sizeKB > RULES.maxImageSizeKB) {
          errors.push({
            severity: 'High',
            title: 'Тяжелое изображение',
            details: `Картинка весит ${sizeKB} KB (лимит ${RULES.maxImageSizeKB} KB).`,
            fix: 'Сожмите изображение перед отправкой.'
          });
        }
      }
    }).get();

    await Promise.all(imagePromises);

    // 3. AI-ПРАВИЛА (Google Gemini)
    const optimizedHtml = minifyHtmlForAI(html);

    const prompt = `
      Проанализируй HTML код email-шаблона.
      СТАТИСТИКА: Символов текста: ${textLength}, Изображений: ${imagesCount}.
      ПРАВИЛА: ${RULES.aiGuidelines.join(' ')}
      HTML КОД: ${optimizedHtml}
    `;

    let aiErrors = [];
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
        },
        systemInstruction: `Ты строгий валидатор email-шаблонов. Верни СТРОГО массив JSON. Формат: [{"severity": "High" | "Medium" | "Low", "title": "Название", "details": "Описание", "fix": "Как исправить"}]`
      });

      const result = await model.generateContent(prompt);
      const rawText = result.response.text();
      
      aiErrors = JSON.parse(rawText);
      if (!Array.isArray(aiErrors)) aiErrors = [];
    } catch (e) {
      console.error("Ошибка генерации Gemini:", e);
    }

    return NextResponse.json({ results: [...errors, ...aiErrors] });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
