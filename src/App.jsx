import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)

  // Завантаження контактів з localStorage при завантаженні компонента
  useEffect(() => {
    const savedContacts = localStorage.getItem('vcf-contacts')
    if (savedContacts) {
      try {
        setContacts(JSON.parse(savedContacts))
      } catch (error) {
        console.error('Помилка при завантаженні контактів:', error)
      }
    }
  }, [])

  // Збереження контактів в localStorage
  useEffect(() => {
    if (contacts.length > 0) {
      localStorage.setItem('vcf-contacts', JSON.stringify(contacts))
    }
  }, [contacts])

  // Парсинг рядка контакту
  const parseContactLine = (line) => {
    if (!line.trim()) return null

    // Знаходимо номер телефону (починається з 380, 11-12 цифр)
    const phoneMatch = line.match(/^(\d{11,12})/)
    if (!phoneMatch) return null

    const phone = phoneMatch[1]
    // Видаляємо номер телефону та нормалізуємо пробіли (табуляції та подвійні пробіли)
    let remaining = line.substring(phone.length).replace(/\t/g, ' ').replace(/\s+/g, ' ').trim()

    // Знаходимо додаткову інформацію у форматі ~TG ...~
    const tgInfoMatch = remaining.match(/~TG\s+(\d+)\s+\|\s+(\d+)~/)
    let tgInfo = null
    if (tgInfoMatch) {
      tgInfo = {
        tgPhone: tgInfoMatch[1],
        tgId: tgInfoMatch[2]
      }
      remaining = remaining.substring(0, remaining.indexOf('~TG')).trim()
    }

    // Розділяємо ім'я та нікнейм
    const parts = remaining.split(/\s+/).filter(part => part.length > 0)
    let name = ''
    let nickname = ''

    if (parts.length > 0) {
      // Знаходимо нікнейм (останній елемент, якщо він виглядає як нікнейм)
      const lastPart = parts[parts.length - 1]
      // Нікнейм зазвичай містить підкреслення, або складається тільки з латинських букв/цифр
      if (lastPart && (
        lastPart.includes('_') || 
        (lastPart.match(/^[a-zA-Z0-9_]+$/) && !lastPart.match(/^[А-Яа-яЁёІіЇїЄєҐґ]+$/))
      )) {
        nickname = lastPart
        name = parts.slice(0, -1).join(' ')
      } else {
        name = parts.join(' ')
      }
    }

    return {
      phone,
      name: name.trim() || 'Без імені',
      nickname: nickname.trim() || '',
      tgInfo
    }
  }

  // Обробка завантаження файлу
  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setLoading(true)

    try {
      const text = await file.text()
      const lines = text.split('\n')
      
      const parsedContacts = lines
        .map(line => parseContactLine(line))
        .filter(contact => contact !== null)

      setContacts(parsedContacts)
    } catch (error) {
      console.error('Помилка при обробці файлу:', error)
      alert('Помилка при обробці файлу. Перевірте формат файлу.')
    } finally {
      setLoading(false)
      // Очищаємо input для можливості завантажити той самий файл знову
      event.target.value = ''
    }
  }

  // Очищення контактів
  const handleClearContacts = () => {
    setContacts([])
    localStorage.removeItem('vcf-contacts')
  }

  // Кодування тексту в QUOTED-PRINTABLE формат
  const encodeQuotedPrintable = (text) => {
    if (!text) return ''
    
    // Конвертуємо текст в UTF-8 байти
    const utf8Bytes = new TextEncoder().encode(text)
    let encodedBytes = ''
    
    for (let i = 0; i < utf8Bytes.length; i++) {
      const byte = utf8Bytes[i]
      
      // Символи, які не потрібно кодувати (ASCII printable, крім =)
      if (byte >= 33 && byte <= 126 && byte !== 61) {
        encodedBytes += String.fromCharCode(byte)
      } else if (byte === 32) {
        // Пробіл - закодовуємо як =20
        encodedBytes += '=20'
      } else {
        // Інші символи кодуємо як =XX
        encodedBytes += '=' + byte.toString(16).toUpperCase().padStart(2, '0')
      }
    }
    
    // Розбиваємо на рядки максимум 75 символів (з soft line break)
    // Важливо: не розривати закодовані символи (=XX)
    const maxLineLength = 75
    let result = ''
    let currentLine = ''
    let i = 0
    
    while (i < encodedBytes.length) {
      const char = encodedBytes[i]
      
      // Якщо це початок закодованого символу (=) і залишилося менше 3 символів до ліміту
      if (char === '=' && currentLine.length + 3 > maxLineLength && currentLine.length > 0) {
        // Додаємо soft line break і переносимо =XX на новий рядок
        result += currentLine + '=\r\n'
        currentLine = ''
        // Додаємо весь закодований символ (=XX)
        if (i + 2 < encodedBytes.length) {
          currentLine = encodedBytes.substring(i, i + 3)
          i += 3
        } else {
          currentLine = encodedBytes.substring(i)
          i = encodedBytes.length
        }
      } else if (currentLine.length + 1 > maxLineLength) {
        // Додаємо soft line break
        result += currentLine + '=\r\n'
        currentLine = char
        i++
      } else {
        currentLine += char
        i++
      }
    }
    
    // Додаємо останній рядок
    if (currentLine.length > 0) {
      result += currentLine
    }
    
    return result
  }

  // Створення VCF контакту з заданими параметрами
  const createVCFCard = (name, phoneNumber) => {
    const lines = []
    
    lines.push('BEGIN:VCARD')
    lines.push('VERSION:2.1')
    
    // Розділяємо ім'я на частини (прізвище, ім'я, по-батькові)
    const nameParts = name.trim().split(/\s+/)
    let lastName = ''
    let firstName = ''
    let middleName = ''
    
    if (nameParts.length >= 1) {
      lastName = nameParts[0] || ''
    }
    if (nameParts.length >= 2) {
      firstName = nameParts[1] || ''
    }
    if (nameParts.length >= 3) {
      middleName = nameParts.slice(2).join(' ') || ''
    }
    
    // N (ім'я) - формат: LastName;FirstName;MiddleName;Prefix;Suffix
    const nValue = `${lastName};${firstName};${middleName};;`
    lines.push(`N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(nValue)}`)
    
    // FN (повне ім'я)
    const fullName = name.trim() || 'Без імені'
    lines.push(`FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:${encodeQuotedPrintable(fullName)}`)
    
    // Телефон - форматуємо номер (додаємо + якщо потрібно)
    let phone = phoneNumber
    if (phone && !phone.startsWith('+')) {
      if (phone.startsWith('380')) {
        phone = '+' + phone
      }
    }
    lines.push(`TEL;CELL:${phone}`)
    
    lines.push('END:VCARD')
    
    return lines.join('\r\n')
  }

  // Конвертація контакту у VCF формат (створює один або два контакти)
  const contactToVCF = (contact) => {
    const vcfCards = []
    
    // Основний контакт
    const mainName = contact.name.trim() || 'Без імені'
    const mainPhone = contact.phone
    
    vcfCards.push(createVCFCard(mainName, mainPhone))
    
    // Якщо є інформація про Telegram, створюємо другий контакт з тим самим ім'ям
    // Телефон автоматично об'єднає їх і покаже Telegram в підключених додатках
    if (contact.tgInfo && contact.tgInfo.tgPhone) {
      // Використовуємо те саме ім'я для об'єднання контактів
      // Але можна додати нікнейм або іншу інформацію для розрізнення
      let tgName = contact.name.trim()
      
      // Якщо є нікнейм, можна додати його до імені (опціонально)
      // Або залишити те саме ім'я для автоматичного об'єднання
      
      vcfCards.push(createVCFCard(tgName, contact.tgInfo.tgPhone))
    }
    
    return vcfCards.join('\r\n')
  }

  // Завантаження VCF файлу
  const handleDownloadVCF = () => {
    if (contacts.length === 0) {
      alert('Немає контактів для завантаження!')
      return
    }

    // Конвертуємо всі контакти у VCF формат
    const vcfContent = contacts.map(contact => contactToVCF(contact)).join('\r\n')
    
    // Створюємо Blob та завантажуємо файл
    const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'contacts.vcf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    alert(`Завантажено ${contacts.length} контактів у форматі VCF!`)
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>VCF Converter</h1>
        
        <div className="card" style={{ width: '100%', maxWidth: '100%' }}>
          <div className="upload-section">
            <label htmlFor="file-upload" className="upload-button">
              {loading ? 'Обробка...' : 'Завантажити файл'}
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".txt,.csv"
              onChange={handleFileUpload}
              disabled={loading}
              style={{ display: 'none' }}
            />
          </div>

          {contacts.length > 0 && (
            <>
              <div className="contacts-info">
                <p>Завантажено контактів: <strong>{contacts.length}</strong></p>
                <button onClick={handleDownloadVCF} className="download-button">
                  Скачати VCF
                </button>
                <button onClick={handleClearContacts} className="clear-button">
                  Очистити
                </button>
              </div>

              <div className="contacts-list" style={{ width: '100%', maxWidth: '100%' }}>
                <h2>Контакти:</h2>
                <div className="contacts-table" style={{ opacity: 1, width: '100%', overflowY: 'auto' }}>
                  {contacts.map((contact, index) => (
                    <div key={index} className="table-row">
                      <div>{contact.phone}</div>
                      <div>{contact.name}</div>
                      <div>{contact.nickname || '-'}</div>
                      <div>{contact.tgInfo?.tgId || '-'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {contacts.length === 0 && !loading && (
            <p className="hint">
              Завантажте файл з контактами для початку роботи
            </p>
          )}
        </div>
      </header>
    </div>
  )
}

export default App

