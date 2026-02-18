import { Link } from 'react-router-dom'
import { BookOpen, Upload, Search, Library } from 'lucide-react'

function HomePage() {
  const features = [
    {
      icon: Library,
      title: 'Каталог литературы',
      description: 'Доступ к агрегированной коллекции учебных материалов из различных источников',
      link: '/library',
    },
    {
      icon: Upload,
      title: 'Загрузка файлов',
      description: 'Загружайте собственные PDF, EPUB и другие документы',
      link: '/upload',
    },
    {
      icon: Search,
      title: 'Умный поиск',
      description: 'Быстрый полнотекстовый поиск по всей библиотеке',
      link: '/search',
    },
    {
      icon: BookOpen,
      title: 'Встроенный читатель',
      description: 'Читайте документы прямо в браузере без скачивания',
      link: '/library',
    },
  ]

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Система агрегации учебной литературы
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          Единая платформа для поиска, хранения и чтения учебных материалов
          из открытых источников и вашей личной коллекции
        </p>
        <div className="flex justify-center space-x-4">
          <Link
            to="/library"
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Открыть библиотеку
          </Link>
          <Link
            to="/upload"
            className="px-6 py-3 bg-white text-blue-600 font-medium rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors"
          >
            Загрузить файл
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {features.map(({ icon: Icon, title, description, link }) => (
          <Link
            key={title}
            to={link}
            className="p-6 bg-white rounded-xl shadow-sm border hover:shadow-md transition-shadow"
          >
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <Icon className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-gray-600 text-sm">{description}</p>
          </Link>
        ))}
      </section>

      {/* Stats Section */}
      <section className="bg-white rounded-xl shadow-sm border p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Источники данных
        </h2>
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-blue-600">Open Library</div>
            <p className="text-gray-600 mt-2">Миллионы книг в открытом доступе</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">Project Gutenberg</div>
            <p className="text-gray-600 mt-2">60,000+ бесплатных электронных книг</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">Ваши файлы</div>
            <p className="text-gray-600 mt-2">Загружайте и храните свою коллекцию</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
