import { createFileRoute } from '@tanstack/react-router';
import { ServicesPage } from '@/pages/services.tsx';

export const Route = createFileRoute('/hizmetler')({
  component: ServicesPage,
});
