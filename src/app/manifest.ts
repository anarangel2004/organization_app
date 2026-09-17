import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Atelier Agenda',
    short_name: 'Atelier',
    description: 'Gestão integrada de rotinas académicas e profissionais',
    start_url: '/',
    display: 'standalone',
    background_color: '#FCF9F2',
    theme_color: '#111111',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
