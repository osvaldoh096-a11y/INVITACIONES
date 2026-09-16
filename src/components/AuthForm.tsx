import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import { FormField } from './FormField';
import { loginSchema, type LoginFormData } from '../lib/validations';
import { authService } from '../lib/api';

/**
 * Solo login: este panel es interno (tú y tu equipo), no hay
 * auto-registro público. Las cuentas se crean con el script de seed
 * o desde una cuenta ya autenticada.
 */
export default function AuthForm() {
  const {
    handleSubmit,
    register,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await authService.login(data);
      toast.success('Sesión iniciada');
      window.location.href = '/admin';
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al iniciar sesión';
      toast.error(message);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Panel de administración</CardTitle>
        <CardDescription>Inicia sesión con tu cuenta de equipo.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Correo"
            name="email"
            type="email"
            placeholder="tu@negocio.com"
            register={register}
            errors={errors}
            required
            disabled={isSubmitting}
          />

          <FormField
            label="Contraseña"
            name="password"
            type="password"
            placeholder="••••••••"
            register={register}
            errors={errors}
            required
            disabled={isSubmitting}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
