"use client";
import { MutationField } from "../../shared/ui/admin-mutation-form";

export function CatalogEntityFields({kind}:{kind:"categories"|"brands"}) { return <>
          <MutationField name="name" label="Nombre"><input name="name" required /></MutationField>
          {kind==='categories'?<>
            <MutationField name="slug" label="Slug"><input name="slug" required /></MutationField>
            <MutationField name="description" label="Descripción"><textarea name="description" required /></MutationField>
            <MutationField name="title" label="Título"><input name="title" required /></MutationField>
          </>:<>
            <MutationField name="text" label="Descripción"><textarea name="text" required /></MutationField>
            <MutationField name="siteTitle" label="Título SEO"><input name="siteTitle" required /></MutationField>
          </>}
          <MutationField name="keywords" label="Palabras clave"><input name="keywords" required /></MutationField>
          <label className="adminCheckbox"><input defaultChecked name="isActive" type="checkbox" />Activa</label>
  </>;
}
