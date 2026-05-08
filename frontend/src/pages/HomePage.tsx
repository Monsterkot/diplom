import { Link } from 'react-router-dom'
import { BookOpen, Upload, Search, Library } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'

function HomePage() {
  const { t } = useLanguage()

  const features = [
    {
      icon: Library,
      title: t('home.featureCatalogTitle'),
      description: t('home.featureCatalogDescription'),
      link: '/library',
    },
    {
      icon: Upload,
      title: t('home.featureUploadTitle'),
      description: t('home.featureUploadDescription'),
      link: '/upload',
    },
    {
      icon: Search,
      title: t('home.featureSearchTitle'),
      description: t('home.featureSearchDescription'),
      link: '/search',
    },
    {
      icon: BookOpen,
      title: t('home.featureReaderTitle'),
      description: t('home.featureReaderDescription'),
      link: '/library',
    },
  ]

  return (
    <div className="space-y-12">
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          {t('home.heroTitle')}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
          {t('home.heroSubtitle')}
        </p>
        <div className="flex justify-center space-x-4">
          <Link
            to="/library"
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('home.openLibrary')}
          </Link>
          <Link
            to="/upload"
            className="px-6 py-3 bg-white text-blue-600 font-medium rounded-lg border border-blue-600 hover:bg-blue-50 transition-colors"
          >
            {t('home.uploadFile')}
          </Link>
        </div>
      </section>

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

      <section className="bg-white rounded-xl shadow-sm border p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          {t('home.sourcesTitle')}
        </h2>
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-blue-600">Google Books</div>
            <p className="text-gray-600 mt-2">{t('home.sourceGoogle')}</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">{t('home.sourceLocalTitle')}</div>
            <p className="text-gray-600 mt-2">{t('home.sourceLocal')}</p>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">{t('home.sourceFilesTitle')}</div>
            <p className="text-gray-600 mt-2">{t('home.sourceFiles')}</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
