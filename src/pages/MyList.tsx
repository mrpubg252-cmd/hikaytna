import { Link } from "react-router-dom";
import { Play, Check, Trash2, History } from "lucide-react";
import { useListStore } from "../store/listStore";

export default function MyList() {
  const { myList, removeFromList, clearList } = useListStore();

  return (
    <div className="min-h-screen bg-[#141414] pt-28 px-6 md:px-16 pb-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-white flex items-center gap-3">
          <History className="w-8 h-8 text-red-600" />
          قائمتي
        </h1>
        {myList.length > 0 && (
          <button
            onClick={clearList}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>مسح السجل</span>
          </button>
        )}
      </div>

      {myList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-gray-500">
          <History className="w-20 h-20 mb-4 opacity-20" />
          <h2 className="text-2xl font-bold text-white mb-2">القائمة فارغة</h2>
          <p className="mb-6 text-center max-w-md">
            لم تقم بإضافة أي مسلسلات إلى قائمتك بعد. اكتشف مكتبتنا الواسعة وأضف مسلسلاتك المفضلة هنا.
          </p>
          <Link
            to="/"
            className="bg-white text-black px-8 py-3 rounded-md font-bold hover:bg-gray-200 transition-colors"
          >
            تصفح المسلسلات
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {myList.map((series) => (
            <div key={series.id} className="relative aspect-[16/9] md:aspect-[2/3] rounded-md overflow-hidden group">
              <img
                src={series.coverImage}
                alt={series.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                <h3 className="font-bold text-white text-lg mb-2 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                  {series.title}
                </h3>
                <div className="flex items-center gap-3 translate-y-4 group-hover:translate-y-0 transition-transform duration-300 delay-75">
                  <Link
                    to={`/series/${series.id}`}
                    className="bg-white text-black p-2 rounded-full hover:bg-gray-200 transition-colors"
                  >
                    <Play className="w-4 h-4 pl-0.5" fill="currentColor" />
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeFromList(series.id);
                    }}
                    className="border-2 border-gray-400 text-white p-2 rounded-full hover:border-red-500 hover:text-red-500 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
