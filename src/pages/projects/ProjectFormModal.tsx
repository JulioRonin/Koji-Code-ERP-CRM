import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, isValid } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CyberDatePicker } from '@/components/ui/CyberDatePicker';

const projectSchema = z.object({
  name: z.string().min(3, {
    message: "El nombre del proyecto debe tener al menos 3 caracteres.",
  }),
  client: z.string().min(2, {
    message: "El nombre del cliente debe tener al menos 2 caracteres.",
  }),
  description: z.string().optional(),
  manager: z.string({
    message: "Por favor selecciona un Project Manager.",
  }),
  startDate: z.date({
    message: "La fecha de inicio es requerida.",
  }),
  deadline: z.date({
    message: "La fecha de entrega es requerida.",
  }),
}).refine((data) => data.deadline > data.startDate, {
  message: "La fecha de entrega debe ser posterior a la fecha de inicio.",
  path: ["deadline"],
});

type ProjectFormValues = z.infer<typeof projectSchema>;

interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectFormValues) => void;
}

export function ProjectFormModal({ isOpen, onClose, onSubmit }: ProjectFormModalProps) {
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      client: "",
      description: "",
      manager: "",
      startDate: undefined,
      deadline: undefined,
    },
  });

  const handleSubmit = (data: ProjectFormValues) => {
    onSubmit(data);
    form.reset();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
          <DialogDescription>
            Ingresa los detalles iniciales del proyecto. Podrás agregar más información después.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Nombre del Proyecto</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Eje Principal Ensamblaje" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cliente</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. BRP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manager"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Manager</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un PM" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Carlos M.">Carlos M.</SelectItem>
                        <SelectItem value="Ana G.">Ana G.</SelectItem>
                        <SelectItem value="Luis R.">Luis R.</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Inicio</FormLabel>
                    <FormControl>
                        <CyberDatePicker 
                            value={field.value} 
                            onChange={field.onChange} 
                            placeholder="DD / MM / YYYY"
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Entrega</FormLabel>
                    <FormControl>
                        <CyberDatePicker 
                            value={field.value} 
                            onChange={field.onChange} 
                            placeholder="DD / MM / YYYY"
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Descripción / Notas (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detalles adicionales sobre el proyecto..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} className="border-cyber-border text-cyber-muted hover:bg-cyber-dark/50 hover:text-cyber-neon font-cyber">
                Cancelar
              </Button>
              <Button type="submit" className="bg-cyber-neon text-cyber-dark hover:bg-cyber-neon/90 font-cyber">
                Crear Proyecto
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
